/**
 * The phone-side glue between the WatchConnectivity bridge and the workout
 * store. Mount ONCE near the app root (see app/_layout.tsx). It:
 *
 *   1. Pushes the active-workout snapshot to the watch whenever the draft, the
 *      resolved names, or the paused flag change — and again on reconnect, so a
 *      watch that was out of range catches up to the latest state.
 *   2. Ingests inbound watch messages: validates, de-dupes by messageId, folds
 *      them into the draft via the pure reconcile reducer, applies the result to
 *      the store, enqueues the resulting offline ops (the existing Supabase
 *      path), updates ephemeral pause state, and acks the watch.
 *
 * Single source of truth: the phone owns the draft; the watch only proposes
 * actions. Disconnection is handled by the transport (the watch uses guaranteed
 * `transferUserInfo` when unreachable) plus the reducer's idempotency, so
 * replays on reconnect never double-log.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase/client';
import { enqueue, flush } from '@lib/offline';
// Import store/hook by module path (not the @features/workouts barrel) to keep
// the workout component graph out of the root layout — same require-cycle
// precaution used elsewhere for entry routes.
import { useWorkoutSessionStore } from '@features/workouts/store';
import { useExerciseNames } from '@features/workouts/hooks/useExerciseNames';
import type { WorkoutDraft } from '@features/workouts/schemas';
import {
  activateWatchSession,
  isWatchBridgeAvailable,
  isWatchPaired,
  isWatchReachable,
  onReachabilityChange,
  onWatchMessage,
  pushSnapshot,
  sendAck,
} from './bridge';
import { projectWorkout } from './projection';
import { reduceWatchMessage, type ReconcileCtx } from './reconcile';
import { useWatchStore } from './store';

/** Bounded LRU-ish set of processed message ids (replay guard above idempotency). */
function makeDedup(limit = 200) {
  const seen = new Set<string>();
  const order: string[] = [];
  return {
    has: (id: string) => seen.has(id),
    add: (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      order.push(id);
      if (order.length > limit) {
        const evicted = order.shift();
        if (evicted) seen.delete(evicted);
      }
    },
  };
}

export function useWatchBridge(): void {
  const { i18n } = useTranslation();
  const locale = ((i18n.language as string | undefined) ?? 'en').slice(0, 2) as 'en' | 'fr' | 'ar';

  const draft = useWorkoutSessionStore((s) => s.draft);
  const paused = useWatchStore((s) => s.paused);
  const patchWatch = useWatchStore((s) => s.patch);

  const names = useExerciseNames(draft?.exercises.map((e) => e.exercise_id) ?? [], locale);
  const nameMap = names.data;

  // Keep the latest values in refs so the inbound handler (registered once)
  // always reconciles against current state without re-subscribing per render.
  const draftRef = useRef<WorkoutDraft | null>(draft);
  const userIdRef = useRef<string | null>(null);
  const dedupRef = useRef(makeDedup());
  draftRef.current = draft;

  // Resolve the current user once, and track auth changes, for reconcile ctx.
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) userIdRef.current = data.user?.id ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      userIdRef.current = session?.user?.id ?? null;
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Push the freshest snapshot to the watch.
  const pushCurrent = useRef<() => void>(() => undefined);
  pushCurrent.current = () => {
    if (!isWatchBridgeAvailable()) return;
    pushSnapshot(
      projectWorkout(draftRef.current, {
        resolveName: (id) => nameMap?.get(id)?.name,
        paused: useWatchStore.getState().paused,
        now: new Date().toISOString(),
      }),
    );
  };

  // Activate the session + seed connection state once.
  useEffect(() => {
    if (!isWatchBridgeAvailable()) return;
    activateWatchSession();
    patchWatch({ supported: true });
    void isWatchPaired().then((paired) => patchWatch({ paired }));
    void isWatchReachable().then((reachable) => patchWatch({ reachable }));

    const offReach = onReachabilityChange((reachable) => {
      patchWatch({ reachable });
      // Catch a reconnected watch up to the latest state.
      if (reachable) pushCurrent.current();
    });

    const offMsg = onWatchMessage((msg) => {
      if (dedupRef.current.has(msg.messageId)) {
        sendAck({ kind: 'ack', messageId: msg.messageId, ok: true });
        return;
      }
      const ctx: ReconcileCtx = {
        userId: userIdRef.current,
        now: new Date().toISOString(),
      };
      const result = reduceWatchMessage(draftRef.current, msg, ctx);

      if (result.changed) {
        if (result.draft !== draftRef.current) {
          draftRef.current = result.draft;
          useWorkoutSessionStore.setState({ draft: result.draft });
        }
        for (const op of result.ops) enqueue(op.kind, op.payload, op.id);
        if (result.ops.length > 0) void flush();
        if (result.sessionPatch.paused !== undefined) {
          patchWatch({ paused: result.sessionPatch.paused });
        }
      }

      // Only mark processed once we've successfully handled it, so a failure
      // (e.g. no-user) can be retried by a later resend.
      if (result.ack.ok) dedupRef.current.add(msg.messageId);
      patchWatch({ lastInboundAt: ctx.now });
      sendAck(result.ack);

      // Reflect the new state straight back to the wrist.
      pushCurrent.current();
    });

    // Initial snapshot so a watch launched first sees current state.
    pushCurrent.current();

    return () => {
      offReach();
      offMsg();
    };
    // Mount-once: handlers read live state via refs/getState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-push whenever the draft or resolved names change.
  useEffect(() => {
    pushCurrent.current();
  }, [draft, nameMap, paused]);
}
