import type { AppError } from './errors';

/**
 * Discriminated union for async state. Use this everywhere instead of
 * { loading: boolean, data, error }.
 */
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: AppError };

export const idle = <T>(): AsyncState<T> => ({ status: 'idle' });
export const loading = <T>(): AsyncState<T> => ({ status: 'loading' });
export const success = <T>(data: T): AsyncState<T> => ({ status: 'success', data });
export const failed = <T>(error: AppError): AsyncState<T> => ({ status: 'error', error });
