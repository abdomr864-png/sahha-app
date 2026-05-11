// resolve-streaks: hourly cron worker for the smart-streak system.
//
// For each user whose local time just crossed midnight in the previous hour:
//   1) Resolve yesterday — scheduled-day with no workout becomes either a
//      'freeze_used' (silently absorbed) or a 'missed' (triggers recovery week).
//      Days not on the schedule get a 'rest_day' event so the heatmap reads cleanly.
//   2) Apply the 14-day silence rule: any user with last_workout_date older than
//      14 days has their current_streak reset to 0.
//   3) If today is Monday in the user's locale, run the weekly close: clear
//      recovery flag if last week's target was met, snapshot the new week's
//      target from profiles.training_days_per_week, and regenerate the weekly
//      freeze allowance.
//
// Invoked by:
//   * pg_cron hourly (see migrations/0025_resolve_streaks_cron.sql)
//   * Manual POST during testing — accepts { now?: ISO string, user_id?: uuid }
//
// Service-role only.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { json, preflight } from '../_shared/http.ts';

interface StreakRow {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string | null;
  scheduled_days: number[];
  is_flexible_schedule: boolean;
  freezes_used_this_week: number;
  freezes_available: number;
  week_start_date: string;
  current_week_completions: number;
  current_week_target: number;
  is_recovery_week: boolean;
  timezone: string | null;
  last_resolved_date: string | null;
}

function admin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

/**
 * Best-effort user-local midnight bucket. We use Intl.DateTimeFormat to
 * compute the YYYY-MM-DD in the user's tz; falls back to UTC if tz is invalid.
 */
function userLocalDate(now: Date, tz: string | null): { today: string; dow: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz ?? 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = fmt.format(now); // en-CA → YYYY-MM-DD
    // Day of week (0=Sun..6=Sat) in the same tz.
    const dowFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz ?? 'UTC',
      weekday: 'short',
    });
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dow = map[dowFmt.format(now)] ?? 0;
    return { today, dow };
  } catch {
    const iso = now.toISOString().slice(0, 10);
    return { today: iso, dow: now.getUTCDay() };
  }
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dowOfIso(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay();
}

/**
 * Resolve a single user. Returns a short summary for logs/debug.
 */
async function resolveUser(
  db: SupabaseClient,
  row: StreakRow,
  now: Date,
): Promise<Record<string, unknown>> {
  const local = userLocalDate(now, row.timezone);
  const today = local.today;
  const yesterday = addDays(today, -1);
  const summary: Record<string, unknown> = { user_id: row.user_id, today };

  // Idempotency guard: don't re-resolve a date we already processed.
  if (row.last_resolved_date === today) {
    summary.skipped = 'already_resolved';
    return summary;
  }

  // 1) Yesterday resolution — only when yesterday is in the past (always true
  //    here since the cron runs at top-of-hour).
  const dowYday = dowOfIso(yesterday);
  const wasScheduled = row.is_flexible_schedule || row.scheduled_days.includes(dowYday);

  if (wasScheduled) {
    // Did the user already log a completed/bonus event on yesterday?
    const { data: existing } = await db
      .from('streak_events')
      .select('id, event_type')
      .eq('user_id', row.user_id)
      .eq('event_date', yesterday)
      .in('event_type', ['completed', 'bonus_completed']);
    const completed = (existing ?? []).length > 0;

    if (!completed) {
      if (row.freezes_available > 0) {
        await db.from('streak_events').insert({
          user_id: row.user_id,
          event_date: yesterday,
          event_type: 'freeze_used',
        });
        await db
          .from('user_streaks')
          .update({
            freezes_available: Math.max(0, row.freezes_available - 1),
            freezes_used_this_week: row.freezes_used_this_week + 1,
          })
          .eq('user_id', row.user_id);
        row.freezes_available = Math.max(0, row.freezes_available - 1);
        row.freezes_used_this_week += 1;
        summary.yesterday = 'freeze_used';
      } else {
        await db.from('streak_events').insert({
          user_id: row.user_id,
          event_date: yesterday,
          event_type: 'missed',
        });
        // Don't reset the streak — recovery-week badge instead.
        await db.from('user_streaks').update({ is_recovery_week: true }).eq('user_id', row.user_id);
        await db.from('streak_events').insert({
          user_id: row.user_id,
          event_date: today,
          event_type: 'recovery_week',
        });
        row.is_recovery_week = true;
        summary.yesterday = 'missed';
      }
    } else {
      summary.yesterday = 'completed';
    }
  } else {
    // Day off — log a rest_day so the heatmap shows neutral, not blank.
    await db.from('streak_events').insert({
      user_id: row.user_id,
      event_date: yesterday,
      event_type: 'rest_day',
    });
    summary.yesterday = 'rest_day';
  }

  // 2) 14-day silence reset.
  if (row.last_workout_date) {
    const lastIso = row.last_workout_date;
    const ageDays = Math.floor(
      (new Date(today + 'T00:00:00Z').getTime() - new Date(lastIso + 'T00:00:00Z').getTime()) /
        86_400_000,
    );
    if (ageDays >= 14 && row.current_streak > 0) {
      await db
        .from('user_streaks')
        .update({
          current_streak: 0,
          is_recovery_week: false,
        })
        .eq('user_id', row.user_id);
      await db.from('streak_events').insert({
        user_id: row.user_id,
        event_date: today,
        event_type: 'reset',
        notes: '14d_silence',
      });
      row.current_streak = 0;
      row.is_recovery_week = false;
      summary.reset = '14d_silence';
    }
  }

  // 3) Weekly close (only when today is Monday in user-local).
  if (local.dow === 1) {
    // Snapshot intent from profile.
    const { data: profile } = await db
      .from('profiles')
      .select('training_days_per_week')
      .eq('user_id', row.user_id)
      .maybeSingle();
    const newTarget = (profile?.training_days_per_week as number | null) ?? row.current_week_target;
    const closedRecovery =
      row.is_recovery_week && row.current_week_completions >= row.current_week_target;
    await db
      .from('user_streaks')
      .update({
        week_start_date: today,
        current_week_completions: 0,
        current_week_target: newTarget,
        freezes_used_this_week: 0,
        freezes_available: 1,
        is_recovery_week: closedRecovery ? false : row.is_recovery_week,
      })
      .eq('user_id', row.user_id);
    if (row.current_week_completions >= row.current_week_target) {
      await db.from('streak_events').insert({
        user_id: row.user_id,
        event_date: today,
        event_type: 'week_completed',
      });
    }
    summary.weekly = 'closed';
  }

  // 4) Mark resolved for today.
  await db.from('user_streaks').update({ last_resolved_date: today }).eq('user_id', row.user_id);

  return summary;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  // Only service-role can call this. pg_cron passes the service JWT.
  const auth = req.headers.get('authorization') ?? '';
  const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!auth || !expected || !auth.toLowerCase().includes(expected.toLowerCase())) {
    return json(401, { error: 'unauthenticated' });
  }

  let body: { now?: string; user_id?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const now = body.now ? new Date(body.now) : new Date();
  const db = admin();

  // Pull all candidate users. The "should-resolve-now" decision is per-user
  // because of timezones; we just iterate everyone whose last_resolved_date is
  // not today *in their tz* and let resolveUser() shortcut.
  const q = db
    .from('user_streaks')
    .select(
      'user_id,current_streak,longest_streak,last_workout_date,scheduled_days,is_flexible_schedule,freezes_used_this_week,freezes_available,week_start_date,current_week_completions,current_week_target,is_recovery_week,timezone,last_resolved_date',
    )
    .limit(5000);
  if (body.user_id) q.eq('user_id', body.user_id);
  const { data: rows, error } = await q;
  if (error) return json(500, { error: 'db_error', message: error.message });

  const summaries: Record<string, unknown>[] = [];
  for (const row of (rows as StreakRow[]) ?? []) {
    try {
      summaries.push(await resolveUser(db, row, now));
    } catch (e) {
      summaries.push({ user_id: row.user_id, error: String(e) });
    }
  }
  return json(200, { processed: summaries.length, sample: summaries.slice(0, 25) });
});
