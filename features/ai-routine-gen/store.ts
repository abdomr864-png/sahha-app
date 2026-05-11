// Local in-progress draft for an AI-generated workout or program. Survives a
// reload via MMKV (D1 pattern). Cleared on save or explicit discard.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@lib/offline';
import type { GeneratedWorkout, Program, WorkoutExercise } from '@lib/llm';

const KEY = 'sahha.draftRoutine.v1';

const zStorage = {
  getItem: (k: string) => storage.getString(k) ?? null,
  setItem: (k: string, v: string) => storage.setString(k, v),
  removeItem: (k: string) => storage.delete(k),
};

export interface WorkoutDraft {
  kind: 'workout';
  generation_id: string | null;
  workout: GeneratedWorkout;
  edited: boolean;
}

export interface ProgramDraft {
  kind: 'program';
  program: Program & { program_reasoning?: string };
  request: { goal: string; weeks: number; days_per_week: number };
  edited: boolean;
}

export type RoutineDraft = WorkoutDraft | ProgramDraft;

interface State {
  draft: RoutineDraft | null;
  setWorkout(d: { generation_id: string | null; workout: GeneratedWorkout }): void;
  setProgram(d: ProgramDraft['program'], req: ProgramDraft['request']): void;
  patchWorkoutExercise(index: number, patch: Partial<WorkoutExercise>): void;
  swapWorkoutExercise(index: number, replacement: WorkoutExercise): void;
  removeWorkoutExercise(index: number): void;
  reorderWorkoutExercise(from: number, to: number): void;
  addWorkoutExercise(ex: WorkoutExercise): void;
  patchProgramExercise(
    week: number,
    dayIdx: number,
    exIdx: number,
    patch: Partial<Program['days'][number]['exercises'][number]>,
  ): void;
  discard(): void;
}

export const useDraftRoutineStore = create<State>()(
  persist(
    (set, get) => ({
      draft: null,
      setWorkout: ({ generation_id, workout }) =>
        set({ draft: { kind: 'workout', generation_id, workout, edited: false } }),
      setProgram: (program, request) =>
        set({ draft: { kind: 'program', program, request, edited: false } }),
      patchWorkoutExercise: (index, patch) => {
        const d = get().draft;
        if (d?.kind !== 'workout') return;
        const exercises = d.workout.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e));
        set({ draft: { ...d, workout: { ...d.workout, exercises }, edited: true } });
      },
      swapWorkoutExercise: (index, replacement) => {
        const d = get().draft;
        if (d?.kind !== 'workout') return;
        const exercises = d.workout.exercises.map((e, i) => (i === index ? replacement : e));
        set({ draft: { ...d, workout: { ...d.workout, exercises }, edited: true } });
      },
      removeWorkoutExercise: (index) => {
        const d = get().draft;
        if (d?.kind !== 'workout') return;
        const exercises = d.workout.exercises.filter((_, i) => i !== index);
        set({ draft: { ...d, workout: { ...d.workout, exercises }, edited: true } });
      },
      reorderWorkoutExercise: (from, to) => {
        const d = get().draft;
        if (d?.kind !== 'workout') return;
        const arr = [...d.workout.exercises];
        const [moved] = arr.splice(from, 1);
        if (!moved) return;
        arr.splice(to, 0, moved);
        set({ draft: { ...d, workout: { ...d.workout, exercises: arr }, edited: true } });
      },
      addWorkoutExercise: (ex) => {
        const d = get().draft;
        if (d?.kind !== 'workout') return;
        const exercises = [...d.workout.exercises, ex];
        set({ draft: { ...d, workout: { ...d.workout, exercises }, edited: true } });
      },
      patchProgramExercise: (week, dayIdx, exIdx, patch) => {
        const d = get().draft;
        if (d?.kind !== 'program') return;
        const days = d.program.days.map((day) => {
          if (day.week !== week || day.day_index !== dayIdx) return day;
          return {
            ...day,
            exercises: day.exercises.map((e, i) => (i === exIdx ? { ...e, ...patch } : e)),
          };
        });
        set({ draft: { ...d, program: { ...d.program, days }, edited: true } });
      },
      discard: () => set({ draft: null }),
    }),
    { name: KEY, storage: createJSONStorage(() => zStorage) },
  ),
);
