/**
 * Dashboard read hooks. Screens read the `health_daily` aggregate view from
 * Supabase (never the device), so they stay fast and work offline-ish from
 * cache. `useTodayHealthMetrics` additionally merges in-app logged workouts and
 * the profile weight so Activity/Recovery are populated even with no wearable
 * connected (device metrics are simply 0/absent in that case).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import type { DailyMetric, MetricType } from '../types';

// health_daily / health_metrics are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Raw daily rows for the last `days` (inclusive of today), from health_daily. */
export function useHealthMetrics(days = 7) {
  return useQuery<DailyMetric[]>({
    queryKey: ['health-daily', days, new Date().toDateString()],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return [];
      const since = utcDay(new Date(Date.now() - (days - 1) * 86_400_000));
      const { data, error } = await db
        .from('health_daily')
        .select('metric_type, day, value, unit, sample_count')
        .eq('user_id', userId)
        .gte('day', since)
        .order('day', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyMetric[];
    },
  });
}

export interface TodayHealthMetrics {
  steps: number;
  workoutsCount: number;
  workoutsMinutes: number;
  workoutsDistanceM: number;
  workoutsVolumeKg: number;
  sleepMinutes: number | null;
  restingHr: number | null;
  hrv: number | null;
  hrvVariant: 'SDNN' | 'RMSSD' | null;
  weightKg: number | null;
}

const EMPTY_TODAY: TodayHealthMetrics = {
  steps: 0,
  workoutsCount: 0,
  workoutsMinutes: 0,
  workoutsDistanceM: 0,
  workoutsVolumeKg: 0,
  sleepMinutes: null,
  restingHr: null,
  hrv: null,
  hrvVariant: null,
  weightKg: null,
};

/**
 * Today's Activity + Recovery snapshot for the home dashboard. Keyed
 * `['today-health']` so existing focus/meal invalidations keep refreshing it.
 *
 * Device metrics come from `health_daily` (today, UTC bucket). On top we merge:
 *  - in-app logged workouts (count / active minutes / volume) so gym sessions
 *    show up without any wearable,
 *  - the profile weight as a fallback when no scale sample exists.
 */
export function useTodayHealthMetrics() {
  return useQuery<TodayHealthMetrics>({
    queryKey: ['today-health', new Date().toDateString()],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return EMPTY_TODAY;

      const today = utcDay(new Date());
      const [dailyRes, loggedRes, profRes] = await Promise.all([
        db.from('health_daily').select('metric_type, value').eq('user_id', userId).eq('day', today),
        // In-app gym sessions (local-day window — they're user-logged).
        db
          .from('workouts')
          .select('started_at, ended_at, total_volume_kg')
          .eq('user_id', userId)
          .gte('started_at', startOfTodayISO())
          .lte('started_at', endOfTodayISO()),
        db.from('profiles').select('weight_kg').eq('user_id', userId).maybeSingle(),
      ]);

      const daily = new Map<MetricType, number>();
      for (const r of (dailyRes.data ?? []) as { metric_type: MetricType; value: number }[]) {
        daily.set(r.metric_type, Number(r.value));
      }

      // In-app workouts → count + active minutes (exact, from session times) + volume.
      const logged = (loggedRes.data ?? []) as {
        started_at: string;
        ended_at: string | null;
        total_volume_kg: number | null;
      }[];
      let loggedMinutes = 0;
      let volume = 0;
      for (const w of logged) {
        if (w.ended_at) {
          const ms = new Date(w.ended_at).getTime() - new Date(w.started_at).getTime();
          if (Number.isFinite(ms) && ms > 0) loggedMinutes += ms / 60000;
        }
        volume += Number(w.total_volume_kg ?? 0);
      }

      const hrvSdnn = daily.get('hrv_sdnn');
      const hrvRmssd = daily.get('hrv_rmssd');
      const hrv = hrvSdnn ?? hrvRmssd ?? null;
      const hrvVariant: TodayHealthMetrics['hrvVariant'] =
        hrvSdnn != null ? 'SDNN' : hrvRmssd != null ? 'RMSSD' : null;

      const deviceWeight = daily.get('weight') ?? null;
      const profileWeight =
        (profRes.data as { weight_kg: number | null } | null)?.weight_kg ?? null;

      return {
        steps: Math.round(daily.get('steps') ?? 0),
        workoutsCount: (daily.get('workout') ?? 0) + logged.length,
        workoutsMinutes: Math.round((daily.get('active_minutes') ?? 0) + loggedMinutes),
        workoutsDistanceM: Math.round(daily.get('distance') ?? 0),
        workoutsVolumeKg: Math.round(volume),
        sleepMinutes: daily.has('sleep') ? Math.round(daily.get('sleep') as number) : null,
        restingHr: daily.has('resting_hr') ? Math.round(daily.get('resting_hr') as number) : null,
        hrv: hrv != null ? Math.round(hrv) : null,
        hrvVariant,
        weightKg:
          deviceWeight != null
            ? Math.round(deviceWeight * 10) / 10
            : profileWeight != null
              ? Math.round(Number(profileWeight) * 10) / 10
              : null,
      };
    },
  });
}
