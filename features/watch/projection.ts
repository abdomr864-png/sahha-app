/**
 * Pure projection of the phone's workout draft into the glanceable snapshot the
 * watch renders. No I/O — the caller injects a name resolver (the watch holds no
 * exercise database) and the current timestamp/paused flag, so this is trivially
 * unit-testable and deterministic.
 */
import type { WorkoutDraft } from '@features/workouts';
import {
  PROTOCOL_VERSION,
  emptySnapshot,
  type WatchExerciseView,
  type WatchWorkoutSnapshot,
} from './messages';

export interface ProjectOptions {
  /** Resolve a localized exercise name; falls back to a generic label. */
  resolveName: (exerciseId: string) => string | undefined;
  paused: boolean;
  /** ISO timestamp stamped onto the snapshot. */
  now: string;
}

/**
 * Find the set the watch should foreground: the first incomplete set of the
 * first exercise that still has incomplete sets. When everything is done we
 * point at the last set of the last exercise so the wrist still shows context.
 */
function currentPointers(exercises: WatchExerciseView[]): {
  currentExerciseId: string | null;
  currentSetId: string | null;
} {
  for (const ex of exercises) {
    const next = ex.sets.find((s) => !s.completed);
    if (next) return { currentExerciseId: ex.id, currentSetId: next.id };
  }
  const lastEx = exercises[exercises.length - 1];
  const lastSet = lastEx?.sets[lastEx.sets.length - 1];
  return {
    currentExerciseId: lastEx?.id ?? null,
    currentSetId: lastSet?.id ?? null,
  };
}

export function projectWorkout(
  draft: WorkoutDraft | null,
  opts: ProjectOptions,
): WatchWorkoutSnapshot {
  if (!draft) return { ...emptySnapshot(opts.now), paused: opts.paused };

  const exercises: WatchExerciseView[] = draft.exercises.map((ex) => ({
    id: ex.id,
    name: opts.resolveName(ex.exercise_id) ?? 'Exercise',
    targetReps: ex.target_reps,
    restSeconds: ex.rest_seconds,
    sets: ex.sets.map((s) => ({
      id: s.id,
      index: s.set_index,
      reps: s.reps,
      weightKg: s.weight_kg,
      completed: s.completed,
      isWarmup: s.is_warmup,
    })),
  }));

  const { currentExerciseId, currentSetId } = currentPointers(exercises);

  return {
    v: PROTOCOL_VERSION,
    active: true,
    paused: opts.paused,
    workoutId: draft.id,
    name: draft.name,
    startedAt: draft.started_at,
    currentExerciseId,
    currentSetId,
    exercises,
    updatedAt: opts.now,
  };
}
