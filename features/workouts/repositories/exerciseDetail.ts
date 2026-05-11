import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';

export interface ExerciseDetail {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string;
  difficulty: string | null;
  instructions_en: string | null;
  instructions_fr: string | null;
  instructions_ar: string | null;
  video_url: string | null;
  photo_url: string | null;
}

export async function getExerciseById(id: string): Promise<ExerciseDetail> {
  return mapSb(
    supabase
      .from('exercises')
      .select(
        'id, name_en, name_fr, name_ar, muscle_group, secondary_muscles, equipment, difficulty, instructions_en, instructions_fr, instructions_ar, video_url, photo_url',
      )
      .eq('id', id)
      .single(),
  );
}
