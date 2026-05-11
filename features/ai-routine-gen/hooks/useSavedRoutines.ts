import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';

export interface SavedRoutineRow {
  id: string;
  name: string;
  goal: string | null;
  weeks: number;
  days_per_week: number;
  is_template: boolean;
  is_ai_generated: boolean;
  created_at: string;
}

export function useSavedRoutines(userId: string | undefined) {
  return useQuery({
    queryKey: ['saved-routines', userId],
    enabled: !!userId,
    queryFn: () =>
      mapSb<SavedRoutineRow[]>(
        supabase
          .from('programs')
          .select('id, name, goal, weeks, days_per_week, is_template, is_ai_generated, created_at')
          .eq('user_id', userId!)
          .order('created_at', { ascending: false }),
      ),
    staleTime: 60_000,
  });
}
