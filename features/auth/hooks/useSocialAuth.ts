import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase/client';
import { AppError, toAppError } from '@lib/supabase/errors';
import { signInWithApple, type AppleProfile } from '../services/apple-auth';
import { signInWithGoogle, type GoogleProfile } from '../services/google-auth';

type Provider = 'apple' | 'google';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface OutcomeNew {
  kind: 'new_user';
  session: Session;
  prefill: { email: string | null; fullName: string | null };
}
interface OutcomeReturning {
  kind: 'returning_user';
  session: Session;
}
type Outcome = OutcomeNew | OutcomeReturning;

interface State {
  status: Status;
  provider: Provider | null;
  error: AppError | null;
  outcome: Outcome | null;
}

export function useSocialAuth() {
  const qc = useQueryClient();
  const [state, setState] = useState<State>({
    status: 'idle',
    provider: null,
    error: null,
    outcome: null,
  });

  const handle = useCallback(
    async (
      provider: Provider,
      run: () => Promise<{
        cancelled: boolean;
        session?: Session;
        profile?: AppleProfile | GoogleProfile;
      }>,
    ) => {
      setState({ status: 'loading', provider, error: null, outcome: null });
      try {
        const r = await run();
        if (r.cancelled || !r.session) {
          setState({ status: 'idle', provider: null, error: null, outcome: null });
          return null;
        }
        const outcome = await classify(r.session, r.profile ?? null);
        qc.clear();
        setState({ status: 'success', provider, error: null, outcome });
        return outcome;
      } catch (e) {
        setState({
          status: 'error',
          provider,
          error: toAppError(e),
          outcome: null,
        });
        return null;
      }
    },
    [qc],
  );

  const apple = useCallback(() => handle('apple', signInWithApple), [handle]);
  const google = useCallback(() => handle('google', signInWithGoogle), [handle]);

  const reset = useCallback(
    () => setState({ status: 'idle', provider: null, error: null, outcome: null }),
    [],
  );

  return {
    status: state.status,
    error: state.error,
    activeProvider: state.provider,
    outcome: state.outcome,
    signInWithApple: apple,
    signInWithGoogle: google,
    reset,
  };
}

async function classify(
  session: Session,
  profile: AppleProfile | GoogleProfile | null,
): Promise<Outcome> {
  const userId = session.user.id;
  const { data: row } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (row) return { kind: 'returning_user', session };

  // Apple returns the name only on first sign-in, so write it now if present.
  if (profile?.fullName) {
    await supabase
      .from('profiles')
      .upsert({ user_id: userId, display_name: profile.fullName }, { onConflict: 'user_id' });
  }

  return {
    kind: 'new_user',
    session,
    prefill: {
      email: profile?.email ?? session.user.email ?? null,
      fullName: profile?.fullName ?? null,
    },
  };
}
