import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';
import type { ExerciseFilter, ExerciseLite } from '../schemas';

export async function listExercises(filter: ExerciseFilter): Promise<ExerciseLite[]> {
  let q = supabase
    .from('exercises')
    .select('id, name_en, name_fr, name_ar, muscle_group, equipment')
    .order('name_en', { ascending: true })
    .limit(200);
  if (filter.muscleGroup) q = q.eq('muscle_group', filter.muscleGroup);
  if (filter.equipment) q = q.eq('equipment', filter.equipment);
  if (filter.query.trim().length > 0) {
    const term = `%${filter.query.trim()}%`;
    q = q.or(`name_en.ilike.${term},name_fr.ilike.${term},name_ar.ilike.${term}`);
  }
  return mapSb(q);
}
