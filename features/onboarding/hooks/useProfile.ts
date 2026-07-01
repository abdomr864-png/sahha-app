import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import type { ActivityLevel, DietPreference, GoalPace } from '../schemas';

export interface UserProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  locale: 'en' | 'fr' | 'ar';
  weight_unit: 'kg' | 'lb';
  dob: string | null;
  sex: 'male' | 'female' | 'other' | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  goal: 'hypertrophy' | 'strength' | 'recomp' | 'general' | null;
  experience_level: 'beginner' | 'intermediate' | 'advanced' | null;
  training_days_per_week: number | null;
  equipment_access: 'full_gym' | 'home_gym' | 'minimal' | null;
  activity_level: ActivityLevel | null;
  diet_preference: DietPreference | null;
  goal_pace: GoalPace | null;
  // Recovery / activity goals (0029). Null → app default (see useActivityTargets).
  sleep_goal_min: number | null;
  steps_goal: number | null;
  active_minutes_goal: number | null;
}

const PROFILE_COLUMNS =
  'user_id,username,display_name,avatar_url,bio,locale,weight_unit,dob,sex,height_cm,weight_kg,target_weight_kg,goal,experience_level,training_days_per_week,equipment_access,activity_level,diet_preference,goal_pace,sleep_goal_min,steps_goal,active_minutes_goal';

const PROFILE_QUERY_KEY = ['profile', 'me'] as const;

async function fetchProfileForUser(userId: string | null): Promise<UserProfile | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return (data ?? null) as UserProfile | null;
}

export function useProfile() {
  return useQuery<UserProfile | null>({
    queryKey: PROFILE_QUERY_KEY,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      return fetchProfileForUser(userRes?.user?.id ?? null);
    },
  });
}

export function prefetchProfile(qc: QueryClient, userId: string | null): Promise<void> {
  if (!userId) return Promise.resolve();
  return qc.prefetchQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => fetchProfileForUser(userId),
    staleTime: 60_000,
  });
}

// Warms the profile cache once a session is established, so the Profile tab
// renders with data on first open instead of flashing placeholders.
export function usePrefetchProfile(userId: string | null): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    prefetchProfile(qc, userId);
  }, [qc, userId]);
}

export type ProfileUpdate = Partial<
  Pick<
    UserProfile,
    | 'display_name'
    | 'username'
    | 'bio'
    | 'avatar_url'
    | 'weight_unit'
    | 'height_cm'
    | 'weight_kg'
    | 'target_weight_kg'
    | 'goal'
    | 'experience_level'
    | 'training_days_per_week'
    | 'activity_level'
    | 'diet_preference'
    | 'goal_pace'
    | 'sleep_goal_min'
    | 'steps_goal'
    | 'active_minutes_goal'
  >
>;

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) throw toAppError({ status: 401 });
      const { error } = await supabase
        .from('profiles')
        .update(patch as never)
        .eq('user_id', userId);
      if (error) throw toAppError(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['daily-targets'] });
      qc.invalidateQueries({ queryKey: ['activity-targets'] });
    },
  });
}
