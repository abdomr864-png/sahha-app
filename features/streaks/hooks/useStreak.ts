import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchStreakEvents,
  fetchUserStreak,
  resetStreak,
  updateStreakSchedule,
} from '../repositories/streaks';
import type { UpdateScheduleInput, UserStreak } from '../schemas';
import { isScheduledToday, nextScheduledDay } from '../lib/schedule';

const STREAK_KEY = ['streak', 'me'] as const;
const EVENTS_KEY = ['streak', 'events'] as const;

export function useStreak() {
  return useQuery<UserStreak | null>({
    queryKey: STREAK_KEY,
    staleTime: 60_000,
    queryFn: fetchUserStreak,
  });
}

export function useStreakEvents(sinceDays = 180) {
  return useQuery({
    queryKey: [...EVENTS_KEY, sinceDays] as const,
    staleTime: 5 * 60_000,
    queryFn: () => fetchStreakEvents(sinceDays),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateScheduleInput) => updateStreakSchedule(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STREAK_KEY });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

export function useResetStreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resetStreak(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STREAK_KEY });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

/**
 * Derived view of a streak row: helpful flags the UI consumes without
 * recomputing the logic in every component.
 */
export interface StreakView {
  current: number;
  longest: number;
  weekTarget: number;
  weekCompletions: number;
  freezesAvailable: number;
  isRecoveryWeek: boolean;
  scheduledToday: boolean;
  nextSessionDate: Date | null;
}

export function toStreakView(streak: UserStreak | null | undefined): StreakView | null {
  if (!streak) return null;
  return {
    current: streak.current_streak,
    longest: streak.longest_streak,
    weekTarget: streak.current_week_target,
    weekCompletions: streak.current_week_completions,
    freezesAvailable: streak.freezes_available,
    isRecoveryWeek: streak.is_recovery_week,
    scheduledToday: isScheduledToday(
      streak.scheduled_days as ReadonlyArray<0 | 1 | 2 | 3 | 4 | 5 | 6>,
      streak.is_flexible_schedule,
    ),
    nextSessionDate: nextScheduledDay(
      streak.scheduled_days as ReadonlyArray<0 | 1 | 2 | 3 | 4 | 5 | 6>,
    ),
  };
}
