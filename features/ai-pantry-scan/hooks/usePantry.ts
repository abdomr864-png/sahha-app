import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { listPantry, type PantryRow } from '../repositories/pantry';

/** The user's persisted pantry (last confirmed). Also the offline fallback view. */
export function usePantry() {
  return useQuery<PantryRow[]>({
    queryKey: ['pantry-items'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return [];
      return listPantry(userId);
    },
  });
}
