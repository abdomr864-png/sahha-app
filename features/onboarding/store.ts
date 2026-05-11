import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@lib/offline';
import type { OnboardingDraft } from './schemas';

type Draft = Partial<OnboardingDraft>;

interface State {
  // The user this draft belongs to. We tie the draft to a user so member A's
  // partial answers don't leak into member B's onboarding when they sign in
  // on the same device.
  ownerId: string | null;
  draft: Draft;
  set<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]): void;
  reset(): void;
  // Reset the draft if it belongs to a different user. Call on sign-in /
  // when entering onboarding.
  ensureOwner(userId: string | null): void;
}

const zustandStorage = {
  getItem: (k: string) => storage.getString(k) ?? null,
  setItem: (k: string, v: string) => storage.setString(k, v),
  removeItem: (k: string) => storage.delete(k),
};

export const useOnboardingStore = create<State>()(
  persist(
    (set) => ({
      ownerId: null,
      draft: {},
      set: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
      reset: () => set({ draft: {}, ownerId: null }),
      ensureOwner: (userId) =>
        set((s) => (s.ownerId === userId ? s : { ownerId: userId, draft: {} })),
    }),
    {
      name: 'sahha.onboardingDraft.v2',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
