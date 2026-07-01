/**
 * Pure, idempotent reducer that folds an inbound watch message into the phone's
 * workout draft and emits the offline-queue ops needed to persist it through the
 * EXISTING logging path (same op kinds the in-app store enqueues — see
 * features/workouts/store.ts + services/offlineRunner.ts). The watch never
 * touches Supabase; the phone remains the single source of truth.
 *
 * Idempotency is the central guarantee — a message replayed after a reconnect
 * (or sent by both devices at once) must not double-log:
 *   - Sets are addressed by a stable UUID (`setId`) generated once on the watch.
 *     Re-applying `completeSet` for the same id yields the same draft and the
 *     same queue op id, which the offline queue de-dupes and Supabase upserts in
 *     place. No duplicate rows, ever.
 *   - `startWorkout` uses the message id as the workout id, so a replayed start
 *     resolves to the already-active workout instead of a second one.
 *
 * The reducer does no I/O: the glue (useWatchBridge) applies `draft` to the
 * store and enqueues `ops`. This keeps the tricky logic 100% unit-testable.
 */
import type { OpKind } from '@lib/offline';
import type { SetDraft, WorkoutDraft, WorkoutExerciseDraft } from '@features/workouts';
import type { WatchAck, WatchInbound } from './messages';

export interface QueuedOp {
  kind: OpKind;
  payload: unknown;
  id: string;
}

export interface ReconcileCtx {
  /** Current authed user; required to start a workout from the wrist. */
  userId: string | null;
  /** Injected clock for deterministic output. */
  now: string;
}

export interface ReconcileResult {
  /** Next draft (null when finished/none). Referentially unchanged when no-op. */
  draft: WorkoutDraft | null;
  /** Offline-queue ops to enqueue, in order. Empty for pure-UI changes. */
  ops: QueuedOp[];
  /** Ephemeral session patch the glue applies (pause is not persisted). */
  sessionPatch: { paused?: boolean };
  ack: WatchAck;
  /** True when the draft or session state changed. */
  changed: boolean;
}

function ok(messageId: string): WatchAck {
  return { kind: 'ack', messageId, ok: true };
}
function fail(messageId: string, reason: string): WatchAck {
  return { kind: 'ack', messageId, ok: false, reason };
}

function findExercise(
  draft: WorkoutDraft,
  workoutExerciseId: string,
): WorkoutExerciseDraft | undefined {
  return draft.exercises.find((e) => e.id === workoutExerciseId);
}

/** Replace one exercise's set list immutably. */
function withSets(draft: WorkoutDraft, workoutExerciseId: string, sets: SetDraft[]): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((e) => (e.id === workoutExerciseId ? { ...e, sets } : e)),
  };
}

export function reduceWatchMessage(
  draft: WorkoutDraft | null,
  msg: WatchInbound,
  ctx: ReconcileCtx,
): ReconcileResult {
  const noop = (ack: WatchAck): ReconcileResult => ({
    draft,
    ops: [],
    sessionPatch: {},
    ack,
    changed: false,
  });

  switch (msg.type) {
    case 'startWorkout': {
      if (draft) return noop(ok(msg.messageId)); // already active — idempotent
      if (!ctx.userId) return noop(fail(msg.messageId, 'no-user'));
      // Use the message id as the workout id so a replayed start is a no-op.
      const next: WorkoutDraft = {
        id: msg.messageId,
        user_id: ctx.userId,
        name: msg.name,
        started_at: ctx.now,
        ended_at: null,
        exercises: [],
      };
      return {
        draft: next,
        ops: [{ kind: 'workout.upsert', payload: next, id: next.id }],
        sessionPatch: { paused: false },
        ack: ok(msg.messageId),
        changed: true,
      };
    }

    case 'finishWorkout': {
      if (!draft) return noop(fail(msg.messageId, 'no-active'));
      const ended: WorkoutDraft = { ...draft, ended_at: ctx.now };
      return {
        draft: null,
        ops: [{ kind: 'workout.finish', payload: ended, id: ended.id }],
        sessionPatch: { paused: false },
        ack: ok(msg.messageId),
        changed: true,
      };
    }

    case 'setPaused': {
      // Pause is ephemeral session state, not part of the persisted draft.
      return {
        draft,
        ops: [],
        sessionPatch: { paused: msg.paused },
        ack: ok(msg.messageId),
        changed: true,
      };
    }

    case 'addSet': {
      if (!draft) return noop(fail(msg.messageId, 'no-active'));
      const ex = findExercise(draft, msg.workoutExerciseId);
      if (!ex) return noop(fail(msg.messageId, 'no-exercise'));
      if (ex.sets.some((s) => s.id === msg.setId)) return noop(ok(msg.messageId)); // idempotent
      const newSet: SetDraft = {
        id: msg.setId,
        set_index: ex.sets.length + 1,
        reps: 0,
        weight_kg: 0,
        rpe: null,
        is_warmup: false,
        is_drop_set: false,
        completed: false,
      };
      // Uncompleted sets aren't enqueued (mirrors store.addSet) — they persist
      // only once completed.
      return {
        draft: withSets(draft, ex.id, [...ex.sets, newSet]),
        ops: [],
        sessionPatch: {},
        ack: ok(msg.messageId),
        changed: true,
      };
    }

    case 'updateSet': {
      if (!draft) return noop(fail(msg.messageId, 'no-active'));
      const ex = findExercise(draft, msg.workoutExerciseId);
      if (!ex) return noop(fail(msg.messageId, 'no-exercise'));
      const existing = ex.sets.find((s) => s.id === msg.setId);
      if (!existing) return noop(fail(msg.messageId, 'no-set'));
      const patched: SetDraft = {
        ...existing,
        reps: msg.reps ?? existing.reps,
        weight_kg: msg.weightKg ?? existing.weight_kg,
      };
      // No enqueue — an uncompleted edit isn't persisted until completion
      // (matches store.updateSet). If the set was already completed, re-emit the
      // upsert so the adjusted value reaches Supabase.
      const ops: QueuedOp[] = existing.completed
        ? [
            {
              kind: 'workout_set.upsert',
              payload: { ...patched, workout_exercise_id: ex.id },
              id: patched.id,
            },
          ]
        : [];
      return {
        draft: withSets(
          draft,
          ex.id,
          ex.sets.map((s) => (s.id === msg.setId ? patched : s)),
        ),
        ops,
        sessionPatch: {},
        ack: ok(msg.messageId),
        changed: true,
      };
    }

    case 'completeSet': {
      if (!draft) return noop(fail(msg.messageId, 'no-active'));
      const ex = findExercise(draft, msg.workoutExerciseId);
      if (!ex) return noop(fail(msg.messageId, 'no-exercise'));
      const existing = ex.sets.find((s) => s.id === msg.setId);
      const completed: SetDraft = existing
        ? { ...existing, reps: msg.reps, weight_kg: msg.weightKg, completed: true }
        : {
            id: msg.setId,
            set_index: ex.sets.length + 1,
            reps: msg.reps,
            weight_kg: msg.weightKg,
            rpe: null,
            is_warmup: false,
            is_drop_set: false,
            completed: true,
          };
      const sets = existing
        ? ex.sets.map((s) => (s.id === msg.setId ? completed : s))
        : [...ex.sets, completed];
      // Same op the in-app completeSet enqueues; keyed by the stable set id, so
      // the offline queue de-dupes and Supabase upserts in place → no dup log.
      return {
        draft: withSets(draft, ex.id, sets),
        ops: [
          {
            kind: 'workout_set.upsert',
            payload: { ...completed, workout_exercise_id: ex.id },
            id: completed.id,
          },
        ],
        sessionPatch: {},
        ack: ok(msg.messageId),
        changed: true,
      };
    }

    default: {
      // Exhaustiveness guard — a new message type must be handled above.
      const _exhaustive: never = msg;
      return noop(fail((_exhaustive as WatchInbound).messageId ?? 'unknown', 'unknown-type'));
    }
  }
}
