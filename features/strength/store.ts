import { create } from 'zustand';
import type { LiftId } from './config/lifts';
import type { RatedLevel } from './config/levels';

/**
 * Ephemeral queue of things to celebrate (level-ups + new badges). The
 * recompute mutation pushes onto it; the celebration overlay plays them one at
 * a time. Intentionally NOT persisted — a missed celebration shouldn't replay
 * on next launch; the achievement itself is already saved in the DB.
 */
export type Celebration =
  | { kind: 'level'; liftId: LiftId; level: RatedLevel }
  | { kind: 'badge'; badgeId: string };

interface CelebrationState {
  queue: Celebration[];
  enqueue: (items: Celebration[]) => void;
  /** Remove the head once its animation has played. */
  shift: () => void;
  clear: () => void;
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  queue: [],
  enqueue: (items) => set((s) => (items.length === 0 ? s : { queue: [...s.queue, ...items] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
