import { registerRunner, type Op } from '@lib/offline';
import { supabase } from '@lib/supabase/client';
import { persistWorkoutDraft } from '../repositories/workouts';
import type { WorkoutDraft, WorkoutExerciseDraft, SetDraft } from '../schemas';

let installed = false;

/**
 * One-time bootstrap of the offline runner. Workout state is the only
 * write-path that is intentionally offline-first (rule #9).
 */
export function installWorkoutOfflineRunner(): void {
  if (installed) return;
  installed = true;
  registerRunner(async (op: Op) => {
    switch (op.kind) {
      case 'workout.upsert':
      case 'workout.finish': {
        const draft = op.payload as WorkoutDraft;
        await persistWorkoutDraft(draft);
        return;
      }
      case 'workout_exercise.upsert': {
        const ex = op.payload as WorkoutExerciseDraft & { workout_id?: string };
        if (!ex.workout_id) return;
        const { error } = await supabase.from('workout_exercises').upsert({
          id: ex.id,
          workout_id: ex.workout_id,
          exercise_id: ex.exercise_id,
          order_index: ex.order_index,
        });
        if (error) throw error;
        return;
      }
      case 'workout_set.upsert': {
        const s = op.payload as SetDraft & { workout_exercise_id: string };
        const { error } = await supabase.from('workout_sets').upsert({
          id: s.id,
          workout_exercise_id: s.workout_exercise_id,
          set_index: s.set_index,
          reps: s.reps,
          weight_kg: s.weight_kg,
          rpe: s.rpe,
          is_warmup: s.is_warmup,
          is_drop_set: s.is_drop_set,
        });
        if (error) throw error;
        return;
      }
      case 'workout_set.delete': {
        const { id } = op.payload as { id: string };
        const { error } = await supabase.from('workout_sets').delete().eq('id', id);
        if (error) throw error;
        return;
      }
    }
  });
}
