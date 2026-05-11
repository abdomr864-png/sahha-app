import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { storage } from '@lib/offline/storage';

const CACHE_KEY = 'has-program.v1';
const CACHE_TTL_MS = 24 * 60 * 60_000;

export function useHasProgram() {
  return useQuery<boolean>({
    queryKey: ['has-program'],
    staleTime: 5 * 60_000,
    // Seed from local cache so the "Pick up where you left off" CTA renders on
    // the first frame of cold start instead of after the Supabase round-trip.
    // React Query still refetches in the background and replaces the value
    // when the response arrives.
    initialData: () => {
      const cached = storage.getJSON<{ v: boolean; t: number }>(CACHE_KEY);
      if (!cached) return undefined;
      if (Date.now() - cached.t > CACHE_TTL_MS) return undefined;
      return cached.v;
    },
    queryFn: async () => {
      const { data } = await supabase.from('programs').select('id').limit(1).maybeSingle();
      const v = !!data;
      storage.setJSON(CACHE_KEY, { v, t: Date.now() });
      return v;
    },
  });
}
