import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

export interface ExerciseContext {
  name: string;
  muscleGroup: string | null;
  targetSets: number | null;
  targetReps: number | null;
}

type Locale = 'en' | 'fr' | 'ar';

interface Row {
  id: string;
  target_sets: number | null;
  target_reps: number | null;
  exercises: {
    name_en: string;
    name_fr: string;
    name_ar: string;
    muscle_group: string | null;
  } | null;
}

/**
 * Resolves each adjustment's program_exercise_id to its exercise name, muscle
 * group, and current set/rep targets so the review cards can show what's being
 * tweaked instead of a bare exercise id. Keyed on the sorted id set.
 */
export function useAdjustmentContext(programExerciseIds: string[], locale: Locale) {
  const ids = Array.from(new Set(programExerciseIds)).sort();
  return useQuery<Map<string, ExerciseContext>>({
    queryKey: ['adjustment-context', ids, locale],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_exercises')
        .select('id, target_sets, target_reps, exercises(name_en, name_fr, name_ar, muscle_group)')
        .in('id', ids);
      if (error) throw error;

      const map = new Map<string, ExerciseContext>();
      for (const row of (data ?? []) as unknown as Row[]) {
        const ex = row.exercises;
        const name = locale === 'fr' ? ex?.name_fr : locale === 'ar' ? ex?.name_ar : ex?.name_en;
        map.set(row.id, {
          name: name ?? ex?.name_en ?? '',
          muscleGroup: ex?.muscle_group ?? null,
          targetSets: row.target_sets,
          targetReps: row.target_reps,
        });
      }
      return map;
    },
  });
}
