/**
 * The wire contract for the phone ↔ Apple Watch bridge (Watch Connectivity).
 *
 * Two directions:
 *   - Phone → Watch: a `WatchWorkoutSnapshot` of the active workout, pushed as
 *     the WCSession *application context* (latest-state-wins, survives
 *     disconnection — the watch always sees the freshest snapshot on reconnect).
 *   - Watch → Phone: discrete `WatchInbound` action messages (start/finish/log a
 *     set/…), sent as messages when reachable and via `transferUserInfo`
 *     (guaranteed, FIFO) when not. Every message carries a stable `messageId`
 *     so replays after a reconnect are de-duplicated, and the reconcile reducer
 *     is idempotent on top of that (belt and suspenders).
 *
 * The Swift side (watch app + iOS module) mirrors these shapes as Codable
 * structs — keep the two in sync. `PROTOCOL_VERSION` guards against a stale
 * watch binary talking to a newer phone build.
 *
 * Everything here is plain JSON-serializable data: no Dates (ISO strings), no
 * undefined in payloads that cross the bridge (WCSession dictionaries reject
 * non-property-list values).
 */
import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;

// ── Phone → Watch: active-workout snapshot ─────────────────────────────────

export interface WatchSetView {
  id: string;
  index: number;
  reps: number;
  weightKg: number;
  completed: boolean;
  isWarmup: boolean;
}

export interface WatchExerciseView {
  id: string;
  /** Localized, phone-resolved exercise name (the watch holds no exercise DB). */
  name: string;
  targetReps: number | null;
  restSeconds: number | null;
  sets: WatchSetView[];
}

export interface WatchWorkoutSnapshot {
  v: number;
  /** True when a workout draft is active on the phone. */
  active: boolean;
  paused: boolean;
  workoutId: string | null;
  name: string | null;
  startedAt: string | null;
  /** Glance pointers — the set the watch should foreground. */
  currentExerciseId: string | null;
  currentSetId: string | null;
  exercises: WatchExerciseView[];
  /** ISO timestamp the snapshot was produced (staleness / ordering). */
  updatedAt: string;
}

/** The snapshot for "no active workout" — lets the watch render its start screen. */
export function emptySnapshot(updatedAt: string): WatchWorkoutSnapshot {
  return {
    v: PROTOCOL_VERSION,
    active: false,
    paused: false,
    workoutId: null,
    name: null,
    startedAt: null,
    currentExerciseId: null,
    currentSetId: null,
    exercises: [],
    updatedAt,
  };
}

// ── Watch → Phone: action messages ─────────────────────────────────────────

/**
 * Discriminated union of everything the wrist can ask the phone to do. The
 * phone is the single source of truth: these never touch Supabase on the watch.
 */
export type WatchInbound =
  | { type: 'startWorkout'; messageId: string; name: string | null; at: string }
  | { type: 'finishWorkout'; messageId: string; at: string }
  | { type: 'setPaused'; messageId: string; paused: boolean; at: string }
  | { type: 'addSet'; messageId: string; workoutExerciseId: string; setId: string; at: string }
  | {
      type: 'completeSet';
      messageId: string;
      workoutExerciseId: string;
      setId: string;
      reps: number;
      weightKg: number;
      at: string;
    }
  | {
      type: 'updateSet';
      messageId: string;
      workoutExerciseId: string;
      setId: string;
      reps: number | null;
      weightKg: number | null;
      at: string;
    };

export type WatchInboundType = WatchInbound['type'];

/** Phone → Watch acknowledgement of a processed inbound message. */
export interface WatchAck {
  kind: 'ack';
  messageId: string;
  ok: boolean;
  /** Machine-readable reason when ok === false (e.g. 'no-active', 'no-exercise'). */
  reason?: string;
}

// ── Runtime validation of inbound payloads ─────────────────────────────────
//
// The bridge hands us untyped dictionaries from native; validate before acting
// so a malformed/old-version message can't corrupt the workout draft.

const base = { messageId: z.string().min(1), at: z.string().min(1) };

export const watchInboundSchema: z.ZodType<WatchInbound> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('startWorkout'), ...base, name: z.string().nullable() }),
  z.object({ type: z.literal('finishWorkout'), ...base }),
  z.object({ type: z.literal('setPaused'), ...base, paused: z.boolean() }),
  z.object({
    type: z.literal('addSet'),
    ...base,
    workoutExerciseId: z.string().min(1),
    setId: z.string().min(1),
  }),
  z.object({
    type: z.literal('completeSet'),
    ...base,
    workoutExerciseId: z.string().min(1),
    setId: z.string().min(1),
    reps: z.number().int().min(0),
    weightKg: z.number().min(0),
  }),
  z.object({
    type: z.literal('updateSet'),
    ...base,
    workoutExerciseId: z.string().min(1),
    setId: z.string().min(1),
    reps: z.number().int().min(0).nullable(),
    weightKg: z.number().min(0).nullable(),
  }),
]) as z.ZodType<WatchInbound>;

/** Parse an untyped bridge payload into a typed message, or null if invalid. */
export function parseInbound(raw: unknown): WatchInbound | null {
  const res = watchInboundSchema.safeParse(raw);
  return res.success ? res.data : null;
}
