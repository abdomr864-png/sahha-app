import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

export type TodayNutrition = {
  kcalEaten: number;
  protein: number;
  carbs: number;
  fat: number;
  burnedExercise: number;
  burnedSteps: number;
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Aggregates today's eaten macros (from meal_items) and burned calories
 * (workouts_synced.active_calories + wearable_metrics steps→kcal estimate).
 */
export function useTodayNutrition() {
  return useQuery<TodayNutrition>({
    queryKey: ['today-nutrition', new Date().toDateString()],
    staleTime: 60_000,
    queryFn: async () => {
      const start = startOfTodayISO();
      const end = endOfTodayISO();

      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      const empty: TodayNutrition = {
        kcalEaten: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        burnedExercise: 0,
        burnedSteps: 0,
      };
      if (!userId) return empty;

      const mealsRes = await supabase
        .from('meals')
        .select('id')
        .eq('user_id', userId)
        .gte('eaten_at', start)
        .lte('eaten_at', end);

      const mealIds = (mealsRes.data ?? []).map((m: { id: string }) => m.id);

      let kcalEaten = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      if (mealIds.length > 0) {
        const itemsRes = await supabase
          .from('meal_items')
          .select('calories,protein_g,carbs_g,fat_g')
          .in('meal_id', mealIds);
        for (const it of itemsRes.data ?? []) {
          const row = it as {
            calories: number | null;
            protein_g: number | null;
            carbs_g: number | null;
            fat_g: number | null;
          };
          kcalEaten += Number(row.calories ?? 0);
          protein += Number(row.protein_g ?? 0);
          carbs += Number(row.carbs_g ?? 0);
          fat += Number(row.fat_g ?? 0);
        }
      }

      const wkRes = await supabase
        .from('workouts_synced')
        .select('active_calories')
        .eq('user_id', userId)
        .gte('started_at', start)
        .lte('started_at', end);
      const burnedExercise = (wkRes.data ?? []).reduce(
        (s: number, r: { active_calories: number | null }) => s + Number(r.active_calories ?? 0),
        0,
      );

      const stepsRes = await supabase
        .from('wearable_metrics')
        .select('value')
        .eq('user_id', userId)
        .eq('metric_type', 'steps')
        .gte('recorded_at', start)
        .lte('recorded_at', end);
      const stepsTotal = (stepsRes.data ?? []).reduce(
        (s: number, r: { value: number | null }) => s + Number(r.value ?? 0),
        0,
      );
      // Rough conversion: ~0.04 kcal per step (varies with weight/pace).
      const burnedSteps = Math.round(stepsTotal * 0.04);

      return {
        kcalEaten: Math.round(kcalEaten),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        burnedExercise: Math.round(burnedExercise),
        burnedSteps,
      };
    },
  });
}
