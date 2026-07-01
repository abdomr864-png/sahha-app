import { create } from 'zustand';

/**
 * Ephemeral watch session + connection state. NOT persisted — it's live device
 * state (is a watch paired, is it reachable right now, is the session paused).
 * The persisted source of truth for the workout itself stays in
 * features/workouts/store.ts; this only tracks the bridge.
 */
interface WatchState {
  /** The WatchConnectivity native module is present (iOS dev/EAS build). */
  supported: boolean;
  /** A paired Apple Watch with the Sahha watch app installed exists. */
  paired: boolean;
  /** The watch is currently reachable for live messages. */
  reachable: boolean;
  /** Session paused from either device (ephemeral; not written to Supabase). */
  paused: boolean;
  /** ISO time of the last inbound watch message (for debugging / UI). */
  lastInboundAt: string | null;
  patch(next: Partial<Omit<WatchState, 'patch'>>): void;
}

export const useWatchStore = create<WatchState>((set) => ({
  supported: false,
  paired: false,
  reachable: false,
  paused: false,
  lastInboundAt: null,
  patch: (next) => set(next),
}));
