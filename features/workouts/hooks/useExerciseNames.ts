import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

export interface ExerciseName {
  /** Localized display name. */
  name: string;
  /** English name — used for the free-exercise-db image lookup. */
  nameEn: string;
  muscleGroup: string | null;
  equipment: string | null;
}

type Locale = 'en' | 'fr' | 'ar';

interface Row {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  muscle_group: string | null;
  equipment: string | null;
}

/**
 * Resolves exercise UUIDs (as stored on a workout draft) to their localized
 * name, English name, and muscle group so the live session can render real
 * names + imagery instead of raw ids. Keyed on the sorted id set.
 */
export function useExerciseNames(exerciseIds: string[], locale: Locale) {
  const ids = Array.from(new Set(exerciseIds)).sort();
  return useQuery<Map<string, ExerciseName>>({
    queryKey: ['exercise-names', ids, locale],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name_en, name_fr, name_ar, muscle_group, equipment')
        .in('id', ids);
      if (error) throw error;

      const map = new Map<string, ExerciseName>();
      for (const row of (data ?? []) as unknown as Row[]) {
        const name = locale === 'fr' ? row.name_fr : locale === 'ar' ? row.name_ar : row.name_en;
        map.set(row.id, {
          name: name || row.name_en,
          nameEn: row.name_en,
          muscleGroup: row.muscle_group,
          equipment: row.equipment,
        });
      }
      return map;
    },
  });
}
