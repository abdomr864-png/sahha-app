import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

export type TodayHealth = {
  steps: number;
  workoutsCount: number;
  workoutsMinutes: number;
  workoutsDistanceM: number;
  workoutsVolumeKg: number;
  restingHr: number | null;
  hrv: number | null;
  sleepMinutes: number | null;
  sleepEndedAt: string | null;
  weightKg: number | null;
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Snapshot of today's activity + recovery from synced wearable data.
 * Sleep window = the most recent session that ended within the last 24h.
 * Biometrics fall back to the latest sample within 14 days when nothing
 * was recorded today (resting HR, HRV, weight don't tick every day).
 */
export function useTodayHealth() {
  return useQuery<TodayHealth>({
    queryKey: ['today-health', new Date().toDateString()],
    staleTime: 60_000,
    queryFn: async () => {
      const start = startOfTodayISO();
      const end = endOfTodayISO();

      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      const empty: TodayHealth = {
        steps: 0,
        workoutsCount: 0,
        workoutsMinutes: 0,
        workoutsDistanceM: 0,
        workoutsVolumeKg: 0,
        restingHr: null,
        hrv: null,
        sleepMinutes: null,
        sleepEndedAt: null,
        weightKg: null,
      };
      if (!userId) return empty;

      const stepsRes = await supabase
        .from('wearable_metrics')
        .select('value')
        .eq('user_id', userId)
        .eq('metric_type', 'steps')
        .gte('recorded_at', start)
        .lte('recorded_at', end);
      const steps = Math.round(
        (stepsRes.data ?? []).reduce(
          (s: number, r: { value: number | null }) => s + Number(r.value ?? 0),
          0,
        ),
      );

      // Wearable-synced workouts (runs, rides, etc. from a watch).
      const wkRes = await supabase
        .from('workouts_synced')
        .select('duration_minutes,distance_meters')
        .eq('user_id', userId)
        .gte('started_at', start)
        .lte('started_at', end);
      const syncedWorkouts = wkRes.data ?? [];
      const syncedCount = syncedWorkouts.length;
      const syncedMinutes = syncedWorkouts.reduce(
        (s: number, r: { duration_minutes: number | null }) => s + Number(r.duration_minutes ?? 0),
        0,
      );
      const workoutsDistanceM = syncedWorkouts.reduce(
        (s: number, r: { distance_meters: number | null }) => s + Number(r.distance_meters ?? 0),
        0,
      );

      // In-app logged workouts (the gym sessions the app records itself). These
      // need no wearable — active minutes come from the session's own start/end
      // timestamps and volume from the logged sets, so they're exact.
      const loggedRes = await supabase
        .from('workouts')
        .select('started_at,ended_at,total_volume_kg')
        .eq('user_id', userId)
        .gte('started_at', start)
        .lte('started_at', end);
      const logged = (loggedRes.data ?? []) as {
        started_at: string;
        ended_at: string | null;
        total_volume_kg: number | null;
      }[];
      let loggedMinutes = 0;
      let workoutsVolumeKg = 0;
      for (const w of logged) {
        if (w.ended_at) {
          const ms = new Date(w.ended_at).getTime() - new Date(w.started_at).getTime();
          if (Number.isFinite(ms) && ms > 0) loggedMinutes += ms / 60000;
        }
        workoutsVolumeKg += Number(w.total_volume_kg ?? 0);
      }

      const workoutsCount = syncedCount + logged.length;
      const workoutsMinutes = syncedMinutes + loggedMinutes;

      const sinceISO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const latestMetric = async (type: string) => {
        const { data } = await supabase
          .from('wearable_metrics')
          .select('value,recorded_at')
          .eq('user_id', userId)
          .eq('metric_type', type)
          .gte('recorded_at', sinceISO)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return data ? Number((data as { value: number }).value) : null;
      };

      const [restingHr, hrv, wearableWeight] = await Promise.all([
        latestMetric('resting_heart_rate'),
        latestMetric('hrv'),
        latestMetric('weight'),
      ]);

      // Weight: prefer a recent wearable/scale sample; otherwise fall back to the
      // weight the user entered in onboarding/profile so the card isn't blank.
      let weightKg = wearableWeight;
      if (weightKg == null) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('weight_kg')
          .eq('user_id', userId)
          .maybeSingle();
        const w = (prof as { weight_kg: number | null } | null)?.weight_kg;
        weightKg = w != null ? Number(w) : null;
      }

      const sleepSinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sleepRes = await supabase
        .from('sleep_sessions_synced')
        .select('asleep_minutes,duration_minutes,ended_at')
        .eq('user_id', userId)
        .gte('ended_at', sleepSinceISO)
        .order('ended_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const sleepRow = sleepRes.data as {
        asleep_minutes: number | null;
        duration_minutes: number | null;
        ended_at: string;
      } | null;
      const sleepMinutes = sleepRow
        ? Number(sleepRow.asleep_minutes ?? sleepRow.duration_minutes ?? 0) || null
        : null;
      const sleepEndedAt = sleepRow ? sleepRow.ended_at : null;

      return {
        steps,
        workoutsCount,
        workoutsMinutes: Math.round(workoutsMinutes),
        workoutsDistanceM: Math.round(workoutsDistanceM),
        workoutsVolumeKg: Math.round(workoutsVolumeKg),
        restingHr: restingHr != null ? Math.round(restingHr) : null,
        hrv: hrv != null ? Math.round(hrv) : null,
        sleepMinutes,
        sleepEndedAt,
        weightKg: weightKg != null ? Math.round(weightKg * 10) / 10 : null,
      };
    },
  });
}
