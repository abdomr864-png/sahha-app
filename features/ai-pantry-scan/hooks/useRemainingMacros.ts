import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { useDailyTargets } from '@features/onboarding/hooks/useDailyTargets';
import { useTodayNutrition } from '@features/ai-meal-parse';
import type { MacroSetDTO } from '@lib/llm';

export interface RemainingMacrosResult {
  // target − eaten, clamped at 0 per macro.
  remaining: MacroSetDTO;
  targets: MacroSetDTO;
  eaten: MacroSetDTO;
  // False when the profile lacks the inputs to personalize a target (we still
  // proceed with a sensible default, but prompt the user to set their goal).
  hasTarget: boolean;
  isLoading: boolean;
}

/**
 * Remaining macros for today = daily target − already logged. Target priority is
 * handled by useDailyTargets (personalized → fallback). `hasTarget` lets the UI
 * prompt the user to complete their profile without blocking the feature.
 */
export function useRemainingMacros(): RemainingMacrosResult {
  const targets = useDailyTargets();
  const today = useTodayNutrition();

  const profileComplete = useQuery<boolean>({
    queryKey: ['pantry-profile-complete'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return false;
      const { data } = await supabase
        .from('profiles')
        .select('weight_kg, height_cm, dob, activity_level')
        .eq('user_id', uid)
        .maybeSingle();
      return !!(data?.weight_kg && data?.height_cm && data?.dob && data?.activity_level);
    },
  });

  const t: MacroSetDTO = {
    kcal: targets.data?.kcal ?? 0,
    protein: targets.data?.proteinG ?? 0,
    carbs: targets.data?.carbsG ?? 0,
    fat: targets.data?.fatG ?? 0,
  };
  const eaten: MacroSetDTO = {
    kcal: today.data?.kcalEaten ?? 0,
    protein: today.data?.protein ?? 0,
    carbs: today.data?.carbs ?? 0,
    fat: today.data?.fat ?? 0,
  };
  const remaining: MacroSetDTO = {
    kcal: Math.max(0, t.kcal - eaten.kcal),
    protein: Math.max(0, t.protein - eaten.protein),
    carbs: Math.max(0, t.carbs - eaten.carbs),
    fat: Math.max(0, t.fat - eaten.fat),
  };

  return {
    remaining,
    targets: t,
    eaten,
    hasTarget: profileComplete.data === true,
    isLoading: targets.isPending || today.isPending,
  };
}
