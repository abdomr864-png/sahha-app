import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

// The recovery-goal columns (0029) are newer than the generated Supabase types;
// loosen typing for the select (same escape hatch used in features/health).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * Personalized activity + recovery targets, mirroring useDailyTargets (which
 * does the same for kcal/macros). These were previously hard-coded constants on
 * the home screen (sleep 8h, steps 10k, active 30m); they now come from the
 * user's profile goals with the same defaults as a fallback.
 */
export interface ActivityTargets {
  stepsTarget: number;
  activeMinutesTarget: number;
  sleepTargetMin: number;
}

/** App defaults — used when the profile has no explicit goal set (column null). */
export const ACTIVITY_TARGET_DEFAULTS: ActivityTargets = {
  stepsTarget: 10000,
  activeMinutesTarget: 30, // WHO baseline
  sleepTargetMin: 480, // 8h
};

interface GoalsSlice {
  steps_goal: number | null;
  active_minutes_goal: number | null;
  sleep_goal_min: number | null;
}

export function resolveActivityTargets(goals: GoalsSlice | null): ActivityTargets {
  if (!goals) return ACTIVITY_TARGET_DEFAULTS;
  return {
    stepsTarget: goals.steps_goal ?? ACTIVITY_TARGET_DEFAULTS.stepsTarget,
    activeMinutesTarget: goals.active_minutes_goal ?? ACTIVITY_TARGET_DEFAULTS.activeMinutesTarget,
    sleepTargetMin: goals.sleep_goal_min ?? ACTIVITY_TARGET_DEFAULTS.sleepTargetMin,
  };
}

/**
 * Reads the current user's activity/recovery goals and resolves them against
 * the app defaults. Cached like daily targets; safe for guests (returns
 * defaults). `initialData` keeps the home rings rendering instantly on cold
 * launch instead of flashing empty.
 */
export function useActivityTargets() {
  return useQuery<ActivityTargets>({
    queryKey: ['activity-targets'],
    staleTime: 5 * 60_000,
    initialData: ACTIVITY_TARGET_DEFAULTS,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return ACTIVITY_TARGET_DEFAULTS;
      const { data, error } = await db
        .from('profiles')
        .select('steps_goal,active_minutes_goal,sleep_goal_min')
        .eq('user_id', userId)
        .maybeSingle();
      if (error || !data) return ACTIVITY_TARGET_DEFAULTS;
      return resolveActivityTargets(data as unknown as GoalsSlice);
    },
  });
}
