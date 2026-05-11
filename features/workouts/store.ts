import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { uuidV4 as uuid } from '@lib/ids';
import { storage, enqueue } from '@lib/offline';
import type { SetDraft, WorkoutDraft, WorkoutExerciseDraft } from './schemas';

const KEY = 'sahha.activeWorkout.v1';

const zStorage = {
  getItem: (k: string) => storage.getString(k) ?? null,
  setItem: (k: string, v: string) => storage.setString(k, v),
  removeItem: (k: string) => storage.delete(k),
};

interface State {
  draft: WorkoutDraft | null;
  start(userId: string, name?: string): void;
  addExercise(exerciseId: string): void;
  addSet(workoutExerciseId: string): void;
  updateSet(workoutExerciseId: string, setId: string, patch: Partial<SetDraft>): void;
  completeSet(workoutExerciseId: string, setId: string): void;
  removeSet(workoutExerciseId: string, setId: string): void;
  finish(): void;
  discard(): void;
}

export const useWorkoutSessionStore = create<State>()(
  persist(
    (set, get) => ({
      draft: null,
      start: (userId, name) => {
        const id = uuid();
        const now = new Date().toISOString();
        const draft: WorkoutDraft = {
          id,
          user_id: userId,
          name: name ?? null,
          started_at: now,
          ended_at: null,
          exercises: [],
        };
        set({ draft });
        enqueue('workout.upsert', draft, id);
      },
      addExercise: (exerciseId) => {
        const draft = get().draft;
        if (!draft) return;
        const ex: WorkoutExerciseDraft = {
          id: uuid(),
          exercise_id: exerciseId,
          order_index: draft.exercises.length,
          target_sets: null,
          target_reps: null,
          target_rpe: null,
          rest_seconds: null,
          notes: null,
          sets: [],
        };
        const next: WorkoutDraft = { ...draft, exercises: [...draft.exercises, ex] };
        set({ draft: next });
        enqueue('workout_exercise.upsert', ex, ex.id);
      },
      addSet: (workoutExerciseId) => {
        const draft = get().draft;
        if (!draft) return;
        const ex = draft.exercises.find((e) => e.id === workoutExerciseId);
        if (!ex) return;
        const newSet: SetDraft = {
          id: uuid(),
          set_index: ex.sets.length + 1,
          reps: 0,
          weight_kg: 0,
          rpe: null,
          is_warmup: false,
          is_drop_set: false,
          completed: false,
        };
        set({
          draft: {
            ...draft,
            exercises: draft.exercises.map((e) =>
              e.id === workoutExerciseId ? { ...e, sets: [...e.sets, newSet] } : e,
            ),
          },
        });
      },
      updateSet: (workoutExerciseId, setId, patch) => {
        const draft = get().draft;
        if (!draft) return;
        set({
          draft: {
            ...draft,
            exercises: draft.exercises.map((e) =>
              e.id === workoutExerciseId
                ? {
                    ...e,
                    sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
                  }
                : e,
            ),
          },
        });
      },
      completeSet: (workoutExerciseId, setId) => {
        const draft = get().draft;
        if (!draft) return;
        let completedSet: SetDraft | undefined;
        const next = {
          ...draft,
          exercises: draft.exercises.map((e) =>
            e.id === workoutExerciseId
              ? {
                  ...e,
                  sets: e.sets.map((s) => {
                    if (s.id !== setId) return s;
                    completedSet = { ...s, completed: true };
                    return completedSet;
                  }),
                }
              : e,
          ),
        };
        set({ draft: next });
        if (completedSet) {
          enqueue(
            'workout_set.upsert',
            { ...completedSet, workout_exercise_id: workoutExerciseId },
            completedSet.id,
          );
        }
      },
      removeSet: (workoutExerciseId, setId) => {
        const draft = get().draft;
        if (!draft) return;
        set({
          draft: {
            ...draft,
            exercises: draft.exercises.map((e) =>
              e.id === workoutExerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e,
            ),
          },
        });
        enqueue('workout_set.delete', { id: setId }, setId);
      },
      finish: () => {
        const draft = get().draft;
        if (!draft) return;
        const ended = { ...draft, ended_at: new Date().toISOString() };
        enqueue('workout.finish', ended, ended.id);
        set({ draft: null });
      },
      discard: () => set({ draft: null }),
    }),
    { name: KEY, storage: createJSONStorage(() => zStorage) },
  ),
);
