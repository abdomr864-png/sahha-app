import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

const MEAL_BUCKET = 'meal-photos';

export type MealVerdict = 'good' | 'ok' | 'bad';

export interface MealHistoryEntry {
  id: string;
  name: string | null;
  mealType: string | null;
  eatenAt: string;
  verdict: MealVerdict | null;
  healthScore: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  itemCount: number;
  /** Signed, displayable thumbnail URL (null when the meal had no photo). */
  thumbUrl: string | null;
}

interface MealRow {
  id: string;
  name: string | null;
  meal_type: string | null;
  eaten_at: string;
  verdict: MealVerdict | null;
  health_score: number | null;
  photo_url: string | null;
  meal_items:
    | {
        calories: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
      }[]
    | null;
}

/**
 * Recent meals for the current user, newest first, with macro totals rolled up
 * from meal_items and a short-lived signed URL for each stored photo (the
 * meal-photos bucket is private). Powers the history strip on the meal screen.
 */
export function useMealHistory(limit = 20) {
  return useQuery<MealHistoryEntry[]>({
    queryKey: ['meal-history', limit],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from('meals')
        .select(
          'id, name, meal_type, eaten_at, verdict, health_score, photo_url, meal_items(calories, protein_g, carbs_g, fat_g)',
        )
        .eq('user_id', userId)
        .order('eaten_at', { ascending: false })
        .limit(limit);
      if (error) throw error;

      const rows = (data ?? []) as MealRow[];

      // Sign every stored photo path in one round-trip.
      const paths = rows.map((r) => r.photo_url).filter((p): p is string => !!p);
      const signedByPath = new Map<string, string>();
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from(MEAL_BUCKET)
          .createSignedUrls(paths, 3600);
        for (const s of signed ?? []) {
          if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
        }
      }

      return rows.map((r) => {
        const items = r.meal_items ?? [];
        const totals = items.reduce(
          (acc, it) => ({
            calories: acc.calories + Number(it.calories ?? 0),
            protein: acc.protein + Number(it.protein_g ?? 0),
            carbs: acc.carbs + Number(it.carbs_g ?? 0),
            fat: acc.fat + Number(it.fat_g ?? 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        return {
          id: r.id,
          name: r.name,
          mealType: r.meal_type,
          eatenAt: r.eaten_at,
          verdict: r.verdict,
          healthScore: r.health_score,
          calories: Math.round(totals.calories),
          protein: Math.round(totals.protein),
          carbs: Math.round(totals.carbs),
          fat: Math.round(totals.fat),
          itemCount: items.length,
          thumbUrl: r.photo_url ? (signedByPath.get(r.photo_url) ?? null) : null,
        };
      });
    },
  });
}
