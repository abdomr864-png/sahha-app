import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';
import type { WorkoutDraft } from '../schemas';

export interface WorkoutSummary {
  id: string;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  total_volume_kg: number;
}

export async function listWorkoutHistory(userId: string, limit = 30): Promise<WorkoutSummary[]> {
  return mapSb(
    supabase
      .from('workouts')
      .select('id, name, started_at, ended_at, total_volume_kg')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit),
  );
}

/**
 * Persists an in-memory draft to the server. Used by the offline runner — the
 * UI never blocks on this. Idempotent via client-generated UUIDs (D4).
 */
export async function persistWorkoutDraft(draft: WorkoutDraft): Promise<void> {
  const { error: wErr } = await supabase.from('workouts').upsert({
    id: draft.id,
    user_id: draft.user_id,
    name: draft.name,
    started_at: draft.started_at,
    ended_at: draft.ended_at,
  });
  if (wErr) throw wErr;

  for (const ex of draft.exercises) {
    const { error: eErr } = await supabase.from('workout_exercises').upsert({
      id: ex.id,
      workout_id: draft.id,
      exercise_id: ex.exercise_id,
      order_index: ex.order_index,
    });
    if (eErr) throw eErr;
    if (ex.sets.length > 0) {
      const { error: sErr } = await supabase.from('workout_sets').upsert(
        ex.sets
          .filter((s) => s.completed)
          .map((s) => ({
            id: s.id,
            workout_exercise_id: ex.id,
            set_index: s.set_index,
            reps: s.reps,
            weight_kg: s.weight_kg,
            rpe: s.rpe,
            is_warmup: s.is_warmup,
            is_drop_set: s.is_drop_set,
          })),
      );
      if (sErr) throw sErr;
    }
  }
}
