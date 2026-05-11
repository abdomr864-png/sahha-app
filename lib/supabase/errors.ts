import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Maps a Supabase / Postgrest error to a stable error code that the UI
 * resolves to an i18n key. UI never sees the raw `message`.
 */
export type AppErrorCode =
  | 'network'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'rls'
  | 'conflict'
  | 'validation'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_credentials'
  | 'unknown';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public override readonly cause?: unknown,
  ) {
    super(code);
    this.name = 'AppError';
  }

  /** Stable i18n key the UI can pass to `t()` directly. */
  get i18nKey(): string {
    const key: Record<AppErrorCode, string> = {
      network: 'errors.network',
      unauthenticated: 'errors.unauthenticated',
      forbidden: 'errors.forbidden',
      not_found: 'errors.notFound',
      rate_limited: 'errors.rateLimited',
      rls: 'errors.rls',
      conflict: 'errors.unknown',
      validation: 'errors.validation',
      email_taken: 'errors.emailTaken',
      weak_password: 'errors.weakPassword',
      invalid_credentials: 'errors.invalidCredentials',
      unknown: 'errors.unknown',
    };
    return key[this.code];
  }
}

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

function isPostgrestError(e: unknown): e is PostgrestError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e && 'details' in e;
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = e as ErrorLike;

  // Network failures (fetch throws TypeError on RN when offline)
  if (err?.name === 'TypeError' || err?.message?.includes('Network request failed')) {
    return new AppError('network', e);
  }

  if (isPostgrestError(e)) {
    if (e.code === 'PGRST301' || e.code === '42501') return new AppError('rls', e);
    if (e.code === '23505') return new AppError('conflict', e);
    if (e.code === 'PGRST116') return new AppError('not_found', e);
    if (e.code?.startsWith('22') || e.code?.startsWith('23')) return new AppError('validation', e);
  }

  // Supabase AuthApiError carries `code` like 'user_already_exists',
  // 'weak_password', 'invalid_credentials' alongside an HTTP status.
  if (err?.code === 'user_already_exists' || err?.code === 'email_exists') {
    return new AppError('email_taken', e);
  }
  if (err?.code === 'weak_password') return new AppError('weak_password', e);
  if (err?.code === 'invalid_credentials') return new AppError('invalid_credentials', e);

  if (err?.status === 401) return new AppError('unauthenticated', e);
  if (err?.status === 403) return new AppError('forbidden', e);
  if (err?.status === 404) return new AppError('not_found', e);
  if (err?.status === 409) return new AppError('conflict', e);
  if (err?.status === 429) return new AppError('rate_limited', e);
  if (err?.status === 400 || err?.status === 422) return new AppError('validation', e);

  return new AppError('unknown', e);
}

/**
 * Wraps a Supabase query promise and re-throws as `AppError`.
 *  ```
 *  const rows = await mapSb(supabase.from('workouts').select('*'));
 *  ```
 */
export async function mapSb<T>(
  query: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<NonNullable<T>> {
  const { data, error } = await query;
  if (error) throw toAppError(error);
  if (data === null) throw new AppError('not_found');
  return data as NonNullable<T>;
}
