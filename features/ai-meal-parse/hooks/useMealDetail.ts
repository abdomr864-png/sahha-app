import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import type { MealVerdict } from './useMealHistory';

const MEAL_BUCKET = 'meal-photos';

export interface MealDetailItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantityG: number;
}

export interface MealDetail {
  id: string;
  name: string | null;
  mealType: string | null;
  eatenAt: string;
  verdict: MealVerdict | null;
  healthScore: number | null;
  summary: string | null;
  photoUrl: string | null;
  items: MealDetailItem[];
  total: { calories: number; protein: number; carbs: number; fat: number };
}

interface MealRow {
  id: string;
  name: string | null;
  meal_type: string | null;
  eaten_at: string;
  verdict: MealVerdict | null;
  health_score: number | null;
  ai_summary: string | null;
  photo_url: string | null;
  meal_items:
    | {
        id: string;
        custom_name: string | null;
        calories: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        quantity_g: number | null;
      }[]
    | null;
}

/** Full record for a single logged meal: macros, items, signed photo. */
export function useMealDetail(id: string | undefined) {
  return useQuery<MealDetail | null>({
    queryKey: ['meal-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select(
          'id, name, meal_type, eaten_at, verdict, health_score, ai_summary, photo_url, meal_items(id, custom_name, calories, protein_g, carbs_g, fat_g, quantity_g)',
        )
        .eq('id', id!)
        .single();
      if (error) throw error;
      const row = data as MealRow;

      let photoUrl: string | null = null;
      if (row.photo_url) {
        const { data: signed } = await supabase.storage
          .from(MEAL_BUCKET)
          .createSignedUrl(row.photo_url, 3600);
        photoUrl = signed?.signedUrl ?? null;
      }

      const items: MealDetailItem[] = (row.meal_items ?? []).map((it) => ({
        id: it.id,
        name: it.custom_name ?? '',
        calories: Number(it.calories ?? 0),
        protein: Number(it.protein_g ?? 0),
        carbs: Number(it.carbs_g ?? 0),
        fat: Number(it.fat_g ?? 0),
        quantityG: Number(it.quantity_g ?? 0),
      }));

      const total = items.reduce(
        (acc, it) => ({
          calories: acc.calories + it.calories,
          protein: acc.protein + it.protein,
          carbs: acc.carbs + it.carbs,
          fat: acc.fat + it.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );

      return {
        id: row.id,
        name: row.name,
        mealType: row.meal_type,
        eatenAt: row.eaten_at,
        verdict: row.verdict,
        healthScore: row.health_score,
        summary: row.ai_summary,
        photoUrl,
        items,
        total,
      };
    },
  });
}
