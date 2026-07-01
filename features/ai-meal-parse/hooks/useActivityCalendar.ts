import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

/** How far back we pull activity to fill the calendar grid. */
const RANGE_DAYS = 180;

export type ActivityCalendar = {
  /** Local day key (YYYY-MM-DD) → completion 0..1. */
  byDay: Record<string, number>;
};

/** Local calendar-day key, so a meal eaten at 11pm counts for the right day. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Real per-day activity completion for the home week strip + calendar sheet.
 *
 * Each day has two halves that fill from actual app usage:
 *   - Nutrition (0.5): closes once ~2 meals are logged that day (1 meal = 0.25).
 *   - Training  (0.5): closes when a workout was logged that day.
 *
 * So snapping a meal lights the day up immediately instead of showing a mock.
 * Returns a synchronous `getDayCompletion(date)` the calendar can call per cell.
 */
export function useActivityCalendar() {
  const query = useQuery<ActivityCalendar>({
    queryKey: ['activity-calendar', new Date().toDateString()],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return { byDay: {} };

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - RANGE_DAYS);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const [mealsRes, workoutsRes] = await Promise.all([
        supabase
          .from('meals')
          .select('eaten_at')
          .eq('user_id', userId)
          .gte('eaten_at', startISO)
          .lte('eaten_at', endISO),
        supabase
          .from('workouts')
          .select('started_at')
          .eq('user_id', userId)
          .gte('started_at', startISO)
          .lte('started_at', endISO),
      ]);

      const mealCount: Record<string, number> = {};
      for (const m of mealsRes.data ?? []) {
        const at = (m as { eaten_at: string | null }).eaten_at;
        if (!at) continue;
        const k = dayKey(new Date(at));
        mealCount[k] = (mealCount[k] ?? 0) + 1;
      }

      const workoutDays = new Set<string>();
      for (const w of workoutsRes.data ?? []) {
        const at = (w as { started_at: string | null }).started_at;
        if (at) workoutDays.add(dayKey(new Date(at)));
      }

      const byDay: Record<string, number> = {};
      const keys = new Set<string>([...Object.keys(mealCount), ...workoutDays]);
      for (const k of keys) {
        const nutrition = Math.min(1, (mealCount[k] ?? 0) / 2) * 0.5;
        const training = workoutDays.has(k) ? 0.5 : 0;
        byDay[k] = Math.min(1, nutrition + training);
      }
      return { byDay };
    },
  });

  const byDay = query.data?.byDay;
  const getDayCompletion = useCallback(
    (date: Date): number => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d > today) return 0;
      return byDay?.[dayKey(d)] ?? 0;
    },
    [byDay],
  );

  return { ...query, getDayCompletion };
}
