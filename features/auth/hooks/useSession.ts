import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase/client';

// Module-level cache so a component mounting after the session has already
// resolved (e.g. opening the Profile tab) starts from the known value instead
// of flashing the signed-out UI while its own getSession() re-resolves.
let cachedSession: Session | null | undefined = undefined;
const listeners = new Set<(s: Session | null | undefined) => void>();
let initialized = false;

function emit(next: Session | null | undefined): void {
  cachedSession = next;
  listeners.forEach((l) => l(next));
}

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  void supabase.auth.getSession().then(({ data }) => {
    emit(data.session ?? null);
  });
  supabase.auth.onAuthStateChange((_event, s) => {
    emit(s ?? null);
  });
}

/**
 * Subscribes to Supabase auth state. Returns `undefined` while we're still
 * resolving the persisted session, then `null` (signed out) or a `Session`.
 */
export function useSession(): { session: Session | null | undefined } {
  ensureInitialized();
  const [session, setSession] = useState<Session | null | undefined>(cachedSession);

  useEffect(() => {
    // Catch any change that landed between render and effect, then subscribe.
    if (session !== cachedSession) setSession(cachedSession);
    listeners.add(setSession);
    return () => {
      listeners.delete(setSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once
  }, []);

  return { session };
}
