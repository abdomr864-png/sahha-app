import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import {
  streakEventRow,
  userStreakRow,
  type StreakEvent,
  type UpdateScheduleInput,
  type UserStreak,
} from '../schemas';
import { defaultScheduledDays } from '../lib/schedule';

const STREAK_COLUMNS =
  'user_id,current_streak,longest_streak,total_workouts_logged,last_workout_date,scheduled_days,is_flexible_schedule,freezes_used_this_week,freezes_available,week_start_date,current_week_completions,current_week_target,is_recovery_week,timezone';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Read the streak row, lazily creating it from the user's profile if missing.
 * Lazy-create is safe: the row is a per-user singleton (PK = user_id) and the
 * trigger from 0024 also creates it on first workout completion.
 */
export async function fetchUserStreak(): Promise<UserStreak | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_streaks')
    .select(STREAK_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (data) return userStreakRow.parse(data);

  // Seed from profile.
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('training_days_per_week')
    .eq('user_id', userId)
    .maybeSingle();
  if (profErr) throw toAppError(profErr);
  const target = (profile?.training_days_per_week as number | null) ?? 3;
  const scheduled = defaultScheduledDays(target);
  const insert = {
    user_id: userId,
    scheduled_days: scheduled,
    current_week_target: target,
  };
  const { data: inserted, error: insErr } = await supabase
    .from('user_streaks')
    .insert(insert as never)
    .select(STREAK_COLUMNS)
    .single();
  if (insErr) throw toAppError(insErr);
  return userStreakRow.parse(inserted);
}

export async function fetchStreakEvents(sinceDays = 180): Promise<StreakEvent[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('streak_events')
    .select('id,user_id,event_date,event_type,workout_id,notes')
    .eq('user_id', userId)
    .gte('event_date', sinceStr)
    .order('event_date', { ascending: false });
  if (error) throw toAppError(error);
  return (data ?? []).map((r) => streakEventRow.parse(r));
}

export async function updateStreakSchedule(patch: UpdateScheduleInput): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw toAppError({ status: 401 });
  const { error } = await supabase
    .from('user_streaks')
    .update(patch as never)
    .eq('user_id', userId);
  if (error) throw toAppError(error);
}

export async function resetStreak(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw toAppError({ status: 401 });
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('user_streaks')
    .update({
      current_streak: 0,
      is_recovery_week: false,
      freezes_used_this_week: 0,
      freezes_available: 1,
      current_week_completions: 0,
    } as never)
    .eq('user_id', userId);
  if (error) throw toAppError(error);
  await supabase
    .from('streak_events')
    .insert({ user_id: userId, event_date: today, event_type: 'reset' } as never);
}
