import { useCallback } from 'react';
import { useWorkoutSessionStore } from '../store';
import { supabase } from '@lib/supabase/client';

export function useActiveSession() {
  return useWorkoutSessionStore((s) => s.draft);
}

export function useStartWorkout() {
  const start = useWorkoutSessionStore((s) => s.start);
  return useCallback(
    async (name?: string) => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      start(userId, name);
    },
    [start],
  );
}

export function useFinishWorkout() {
  return useWorkoutSessionStore((s) => s.finish);
}
