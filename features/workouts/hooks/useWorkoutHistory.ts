import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { listWorkoutHistory } from '../repositories/workouts';

export function useWorkoutHistory() {
  return useQuery({
    queryKey: ['workouts', 'history'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return [];
      return listWorkoutHistory(userId);
    },
  });
}
