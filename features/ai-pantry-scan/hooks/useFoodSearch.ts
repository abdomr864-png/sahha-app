import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import type { Locale } from '@lib/llm';

export interface FoodSearchRow {
  id: string;
  name: string;
  name_fr: string | null;
  name_ar: string | null;
  category: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size_g: number;
}

export function foodDisplayName(f: FoodSearchRow, locale: Locale): string {
  if (locale === 'fr') return f.name_fr || f.name;
  if (locale === 'ar') return f.name_ar || f.name;
  return f.name;
}

/** Search the food DB by name across the three locales. Min 2 chars. */
export function useFoodSearch(query: string) {
  const q = query.trim();
  return useQuery<FoodSearchRow[]>({
    queryKey: ['food-search', q],
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // PostgREST `.or()` is comma-delimited — strip chars that would break it.
      const safe = q.replace(/[,%()]/g, ' ').trim();
      if (!safe) return [];
      const { data, error } = await supabase
        .from('foods')
        .select(
          'id, name, name_fr, name_ar, category, calories, protein_g, carbs_g, fat_g, serving_size_g',
        )
        .or(`name.ilike.%${safe}%,name_fr.ilike.%${safe}%,name_ar.ilike.%${safe}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as FoodSearchRow[];
    },
  });
}
