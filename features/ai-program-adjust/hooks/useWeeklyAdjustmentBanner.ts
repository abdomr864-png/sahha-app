import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { storage } from '@lib/offline/storage';

type BannerState = { show: boolean; programId: string | null };

const CACHE_KEY = 'weekly-adjustment-banner.v1';

function isoWeekKey(d: Date): string {
  // Year-week key — invalidates the cache automatically on week rollover.
  const year = d.getFullYear();
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7);
  return `${year}-${week}`;
}

/**
 * Returns true Mon/Tue if the user has at least one program AND no adjustment
 * has been generated this calendar week.
 */
export function useWeeklyAdjustmentBanner() {
  return useQuery<BannerState>({
    queryKey: ['weekly-adjustment-banner'],
    staleTime: 60 * 60_000,
    // Seed from local cache keyed by ISO week. A stale cache from a previous
    // week is ignored, so we never flash a banner that no longer applies.
    initialData: () => {
      const cached = storage.getJSON<{ v: BannerState; wk: string }>(CACHE_KEY);
      if (!cached) return undefined;
      if (cached.wk !== isoWeekKey(new Date())) return undefined;
      return cached.v;
    },
    queryFn: async () => {
      const today = new Date();
      const day = today.getDay(); // 0=Sun, 1=Mon
      const noBanner: BannerState = { show: false, programId: null };
      if (day !== 1 && day !== 2) {
        storage.setJSON(CACHE_KEY, { v: noBanner, wk: isoWeekKey(today) });
        return noBanner;
      }

      const { data: prog } = await supabase
        .from('programs')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prog) {
        storage.setJSON(CACHE_KEY, { v: noBanner, wk: isoWeekKey(today) });
        return noBanner;
      }

      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - ((day + 6) % 7));
      startOfWeek.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('ai_program_adjustments')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', (prog as { id: string }).id)
        .gte('created_at', startOfWeek.toISOString());

      const state: BannerState = {
        show: (count ?? 0) === 0,
        programId: (prog as { id: string }).id,
      };
      storage.setJSON(CACHE_KEY, { v: state, wk: isoWeekKey(today) });
      return state;
    },
  });
}
