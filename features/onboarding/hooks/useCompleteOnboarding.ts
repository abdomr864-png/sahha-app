import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import { useOnboardingStore } from '../store';
import { onboardingSchema, type OnboardingDraft } from '../schemas';

/**
 * Validates the draft, upserts the profile row, then clears local draft.
 * No-op if not signed in (call sites guard on session).
 */
export function useCompleteOnboarding() {
  const reset = useOnboardingStore((s) => s.reset);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (draft: OnboardingDraft) => {
      const parsed = onboardingSchema.parse(draft);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw toAppError({ status: 401 });
      // Cast: activity_level / target_weight_kg / diet_preference / goal_pace
      // were added in migration 0022 and may not yet be in regenerated DB types.
      const payload = {
        user_id: userId,
        locale: parsed.locale,
        weight_unit: parsed.weight_unit,
        username: parsed.username,
        display_name: parsed.display_name,
        sex: parsed.sex,
        dob: parsed.dob,
        height_cm: parsed.height_cm,
        weight_kg: parsed.weight_kg,
        goal: parsed.goal,
        experience_level: parsed.experience_level,
        training_days_per_week: parsed.training_days_per_week,
        equipment_access: parsed.equipment_access,
        injuries: parsed.injuries ?? [],
        activity_level: parsed.activity_level,
        target_weight_kg: parsed.target_weight_kg,
        diet_preference: parsed.diet_preference,
        goal_pace: parsed.goal_pace,
      };
      const { error } = await supabase.from('profiles').upsert(payload as never);
      if (error) throw toAppError(error);
    },
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: ['daily-targets'] });
      qc.invalidateQueries({ queryKey: ['auth-gate-onboarded'] });
    },
  });
}
