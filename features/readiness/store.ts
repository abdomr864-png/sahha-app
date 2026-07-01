/**
 * Today's optional subjective check-in (energy + soreness, 1–5 each). Persisted
 * to local storage keyed by the local day, so it survives relaunch but resets
 * each morning. Kept tiny and offline-first — no server round-trip; it feeds the
 * readiness engine and is folded into the snapshot's `inputs` when synced.
 */
import { create } from 'zustand';
import { storage } from '@lib/offline/storage';
import { localDayKey } from './date';
import type { SubjectiveCheckin } from './types';

const STORAGE_KEY = 'readiness.checkin';

interface Persisted {
  date: string;
  checkin: SubjectiveCheckin;
}

interface CheckinState {
  /** The check-in for today, or null if not filled in yet. */
  checkin: SubjectiveCheckin | null;
  setCheckin: (next: SubjectiveCheckin) => void;
  clear: () => void;
}

function loadToday(): SubjectiveCheckin | null {
  const saved = storage.getJSON<Persisted>(STORAGE_KEY);
  if (saved && saved.date === localDayKey(new Date())) return saved.checkin;
  return null;
}

export const useCheckinStore = create<CheckinState>((set) => ({
  checkin: loadToday(),
  setCheckin: (next) => {
    const payload: Persisted = { date: localDayKey(new Date()), checkin: next };
    storage.setJSON(STORAGE_KEY, payload);
    set({ checkin: next });
  },
  clear: () => {
    storage.delete(STORAGE_KEY);
    set({ checkin: null });
  },
}));
