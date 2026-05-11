import { storage } from './storage';

/**
 * Durable, ordered offline queue.
 *
 * - Operations are JSON-serializable descriptors (not closures).
 * - Each op has a stable id + monotonic createdAt so retries are idempotent.
 * - The runner is registered once at app boot; flushing happens whenever the
 *   network status flips to online or a manual flush() is called.
 *
 * Conflict policy: workout writes are client-wins. Each op carries enough info
 * to upsert against a stable client-generated UUID.
 */

const QUEUE_KEY = 'sahha.offlineQueue.v1';

export type OpKind =
  | 'workout.upsert'
  | 'workout_exercise.upsert'
  | 'workout_set.upsert'
  | 'workout_set.delete'
  | 'workout.finish';

export interface Op<TPayload = unknown> {
  id: string;
  kind: OpKind;
  payload: TPayload;
  createdAt: number;
  attempts: number;
}

type Runner = (op: Op) => Promise<void>;

let runner: Runner | null = null;
let flushing = false;

function read(): Op[] {
  return storage.getJSON<Op[]>(QUEUE_KEY) ?? [];
}

function write(ops: Op[]): void {
  storage.setJSON(QUEUE_KEY, ops);
}

export function registerRunner(r: Runner): void {
  runner = r;
}

export function enqueue<P>(kind: OpKind, payload: P, id: string): void {
  const ops = read();
  // De-dupe by id: latest payload wins.
  const filtered = ops.filter((o) => o.id !== id);
  filtered.push({ id, kind, payload, createdAt: Date.now(), attempts: 0 });
  write(filtered);
}

export function pending(): Op[] {
  return read();
}

export async function flush(): Promise<{ ok: number; failed: number }> {
  if (!runner || flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const ops = read();
    const remaining: Op[] = [];
    for (const op of ops) {
      try {
        await runner(op);
        ok += 1;
      } catch {
        failed += 1;
        remaining.push({ ...op, attempts: op.attempts + 1 });
      }
    }
    write(remaining);
  } finally {
    flushing = false;
  }
  return { ok, failed };
}

export function clearQueue(): void {
  write([]);
}
