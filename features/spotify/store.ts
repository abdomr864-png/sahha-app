/**
 * Spotify connection + playback state. Tokens are NOT kept here (they live in
 * SecureStore via the token manager) — this store only holds non-secret UI
 * state. Only `promptDismissed` is persisted, so the one-time "connect Spotify"
 * suggestion never re-nags after the user dismisses or connects.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storage } from '@lib/offline';
import type {
  PlaybackState,
  SpotifyConnectionStatus,
  SpotifyDegradeReason,
  SpotifyProduct,
} from './types';

const KEY = 'sahha.spotify.v1';

const zStorage = {
  getItem: (k: string) => storage.getString(k) ?? null,
  setItem: (k: string, v: string) => storage.setString(k, v),
  removeItem: (k: string) => storage.delete(k),
};

export interface SpotifyAccount {
  id: string;
  displayName: string | null;
  imageUri: string | null;
}

interface SpotifyState {
  status: SpotifyConnectionStatus;
  product: SpotifyProduct | null;
  /** Whether the App Remote is actively bound to the Spotify app. */
  remoteConnected: boolean;
  degradeReason: SpotifyDegradeReason | null;
  account: SpotifyAccount | null;
  playback: PlaybackState | null;
  promptDismissed: boolean;

  setStatus(status: SpotifyConnectionStatus): void;
  setProduct(product: SpotifyProduct | null): void;
  setRemoteConnected(connected: boolean): void;
  setDegradeReason(reason: SpotifyDegradeReason | null): void;
  setAccount(account: SpotifyAccount | null): void;
  setPlayback(playback: PlaybackState | null): void;
  setTrackImage(trackUri: string, imageUri: string): void;
  dismissPrompt(): void;
  /** Full teardown on disconnect / logout (keeps `promptDismissed`). */
  reset(): void;
}

const INITIAL = {
  status: 'disconnected' as SpotifyConnectionStatus,
  product: null,
  remoteConnected: false,
  degradeReason: null,
  account: null,
  playback: null,
};

export const useSpotifyStore = create<SpotifyState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      promptDismissed: false,

      setStatus: (status) => set({ status }),
      setProduct: (product) => set({ product }),
      setRemoteConnected: (remoteConnected) => set({ remoteConnected }),
      setDegradeReason: (degradeReason) => set({ degradeReason }),
      setAccount: (account) => set({ account }),
      setPlayback: (playback) => set({ playback }),
      setTrackImage: (trackUri, imageUri) => {
        const pb = get().playback;
        // Ignore late image arrivals for a track that's no longer playing.
        if (!pb?.track || pb.track.uri !== trackUri) return;
        set({ playback: { ...pb, track: { ...pb.track, imageUri } } });
      },
      dismissPrompt: () => set({ promptDismissed: true }),
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: KEY,
      storage: createJSONStorage(() => zStorage),
      partialize: (s) => ({ promptDismissed: s.promptDismissed }),
    },
  ),
);

/**
 * Derived: can we show working in-app controls? Requires a connected premium
 * account with a live App Remote binding. Free users / no-app degrade instead.
 */
export function useCanControl(): boolean {
  return useSpotifyStore(
    (s) => s.status === 'connected' && s.product === 'premium' && s.remoteConnected,
  );
}
