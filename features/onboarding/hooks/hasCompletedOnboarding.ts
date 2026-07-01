import { supabase } from '@lib/supabase/client';

/**
 * True once the user has finished onboarding. `profiles.goal` stays null until
 * useCompleteOnboarding upserts it, so a missing/null goal means "needs the
 * quiz". Used by sign-in / sign-up to route a freshly-authenticated user into
 * onboarding instead of straight to the tabs.
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('goal')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data?.goal;
}
