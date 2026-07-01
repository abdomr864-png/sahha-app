// Tracks which program days a user has finished, per program. Persisted via
// MMKV so a completed session stays "done" across launches. Keyed by
// `${programId}|${week}|${dayIndex}` → ISO completion timestamp.
//
// Kept in its own module (no component/feature-barrel imports) for the same
// require-cycle precaution as ./store — the home route imports it directly.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@lib/offline';

const KEY = 'sahha.workoutProgress.v1';

const zStorage = {
  getItem: (k: string) => storage.getString(k) ?? null,
  setItem: (k: string, v: string) => storage.setString(k, v),
  removeItem: (k: string) => storage.delete(k),
};

export function dayKey(programId: string, week: number, dayIndex: number): string {
  return `${programId}|${week}|${dayIndex}`;
}

interface State {
  // map of dayKey → ISO timestamp the day was finished
  completed: Record<string, string>;
  markComplete(programId: string, week: number, dayIndex: number): void;
  clearDay(programId: string, week: number, dayIndex: number): void;
  /** Number of completed days for a program in a given week. */
  weekCompletedCount(programId: string, week: number, dayIndexes: number[]): number;
}

export const useWorkoutProgressStore = create<State>()(
  persist(
    (set, get) => ({
      completed: {},
      markComplete: (programId, week, dayIndex) =>
        set((s) => ({
          completed: {
            ...s.completed,
            [dayKey(programId, week, dayIndex)]: new Date().toISOString(),
          },
        })),
      clearDay: (programId, week, dayIndex) =>
        set((s) => {
          const next = { ...s.completed };
          delete next[dayKey(programId, week, dayIndex)];
          return { completed: next };
        }),
      weekCompletedCount: (programId, week, dayIndexes) => {
        const c = get().completed;
        return dayIndexes.filter((di) => !!c[dayKey(programId, week, di)]).length;
      },
    }),
    { name: KEY, storage: createJSONStorage(() => zStorage) },
  ),
);
