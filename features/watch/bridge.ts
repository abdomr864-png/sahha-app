/**
 * Typed TS wrapper around the native `WatchBridge` Expo module (iOS WCSession,
 * see modules/watch-bridge/ios/WatchBridgeModule.swift).
 *
 * Design choices:
 *  - One serialization contract: everything crosses the bridge as a JSON STRING,
 *    not a nested dictionary. WCSession payloads must be property-list types and
 *    silently coerce nested values; a flat `{ json: "<string>" }` sidesteps that
 *    entirely and keeps the typed contract in messages.ts authoritative.
 *  - Graceful absence: on Android, web, Expo Go, or any build without the native
 *    module, `requireOptionalNativeModule` returns null and every method becomes
 *    a safe no-op. Callers never need to branch on platform.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  parseInbound,
  type WatchAck,
  type WatchInbound,
  type WatchWorkoutSnapshot,
} from './messages';

type NativeSubscription = { remove(): void };

interface WatchBridgeNativeModule {
  isPaired(): Promise<boolean>;
  isReachable(): Promise<boolean>;
  activate(): void;
  /** Set the WCSession application context (latest-state-wins) from a JSON string. */
  updateApplicationContext(json: string): void;
  /** Best-effort live message (used for acks); ignored if the watch is unreachable. */
  sendMessage(json: string): void;
  addListener(
    event: WatchBridgeEvent,
    listener: (payload: { json: string }) => void,
  ): NativeSubscription;
}

type WatchBridgeEvent = 'onWatchMessage' | 'onReachabilityChange' | 'onActivationChange';

const native = requireOptionalNativeModule<WatchBridgeNativeModule>('WatchBridge');

/** Whether the native WatchConnectivity module is available on this platform/build. */
export function isWatchBridgeAvailable(): boolean {
  return native != null;
}

/** Activate the WCSession. Safe to call repeatedly; no-op without the module. */
export function activateWatchSession(): void {
  native?.activate();
}

export async function isWatchPaired(): Promise<boolean> {
  return native ? native.isPaired() : false;
}

export async function isWatchReachable(): Promise<boolean> {
  return native ? native.isReachable() : false;
}

/** Push the active-workout snapshot to the watch (survives disconnection). */
export function pushSnapshot(snapshot: WatchWorkoutSnapshot): void {
  if (!native) return;
  native.updateApplicationContext(JSON.stringify(snapshot));
}

/** Acknowledge a processed inbound message back to the watch (best-effort). */
export function sendAck(ack: WatchAck): void {
  if (!native) return;
  native.sendMessage(JSON.stringify(ack));
}

/**
 * Subscribe to validated inbound messages from the watch. Malformed or
 * wrong-version payloads are dropped (parseInbound returns null) so a stale
 * watch binary can't corrupt state. Returns an unsubscribe function.
 */
export function onWatchMessage(handler: (msg: WatchInbound) => void): () => void {
  if (!native) return () => undefined;
  const sub = native.addListener('onWatchMessage', ({ json }) => {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return;
    }
    const msg = parseInbound(raw);
    if (msg) handler(msg);
  });
  return () => sub.remove();
}

/** Subscribe to reachability changes (watch came in/out of range). */
export function onReachabilityChange(handler: (reachable: boolean) => void): () => void {
  if (!native) return () => undefined;
  const sub = native.addListener('onReachabilityChange', ({ json }) => {
    handler(json === 'true');
  });
  return () => sub.remove();
}
