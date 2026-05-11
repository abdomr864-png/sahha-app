import { useCallback, useState } from 'react';
import { toAppError, type AppError } from '@lib/supabase/errors';

/**
 * Discriminated-union async state. Replaces the loading/data/error triple
 * (architectural rule #2).
 */
export type Async<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: AppError };

export function useAsync<T, A extends unknown[]>(fn: (...args: A) => Promise<T>) {
  const [state, setState] = useState<Async<T>>({ status: 'idle' });
  const run = useCallback(
    async (...args: A) => {
      setState({ status: 'pending' });
      try {
        const data = await fn(...args);
        setState({ status: 'success', data });
        return data;
      } catch (e) {
        setState({ status: 'error', error: toAppError(e) });
        throw e;
      }
    },
    [fn],
  );
  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, run, reset } as const;
}
