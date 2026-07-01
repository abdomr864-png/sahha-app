/**
 * Apple Watch companion bridge (phase 1 — iOS). The watch app itself is native
 * (watchOS SwiftUI, see ../../watch + ../../modules/watch-bridge); this module
 * is the phone-side bridge: the wire contract, the pure projection/reconcile
 * logic, and the glue hook that syncs the active workout with the wrist.
 */
export { useWatchBridge } from './useWatchBridge';
export { useWatchStore } from './store';
export { isWatchBridgeAvailable, isWatchPaired, isWatchReachable } from './bridge';
export { projectWorkout } from './projection';
export { reduceWatchMessage } from './reconcile';
export type { QueuedOp, ReconcileCtx, ReconcileResult } from './reconcile';
export { PROTOCOL_VERSION, parseInbound, emptySnapshot } from './messages';
export type {
  WatchInbound,
  WatchInboundType,
  WatchAck,
  WatchWorkoutSnapshot,
  WatchExerciseView,
  WatchSetView,
} from './messages';
