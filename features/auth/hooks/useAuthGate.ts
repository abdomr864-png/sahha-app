import { useCallback } from 'react';
import { create } from 'zustand';
import { supabase } from '@lib/supabase/client';

interface AuthGateState {
  visible: boolean;
  message: string | null;
  open(message?: string | null): void;
  close(): void;
}

/**
 * Global state for the "sign-in required" bottom sheet. Components don't
 * read this directly — they use `useRequireAuth()` which returns a wrapper
 * that runs the action if the user is signed in, or opens the sheet if not.
 */
export const useAuthGateStore = create<AuthGateState>((set) => ({
  visible: false,
  message: null,
  open: (message = null) => set({ visible: true, message }),
  close: () => set({ visible: false, message: null }),
}));

/**
 * Returns a function that wraps a guarded action. If the user has a Supabase
 * session, the action runs. If not, the auth-required bottom sheet opens.
 *
 * Usage:
 *   const requireAuth = useRequireAuth();
 *   <Button onPress={() => requireAuth(() => createPost(), 'Sign in to post.')} />
 */
export function useRequireAuth() {
  const open = useAuthGateStore((s) => s.open);
  return useCallback(
    async (action: () => void | Promise<void>, message?: string) => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await action();
        return;
      }
      open(message ?? null);
    },
    [open],
  );
}
