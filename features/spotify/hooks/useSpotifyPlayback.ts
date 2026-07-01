import { useCallback, useEffect, useRef } from 'react';
import { useSpotifyStore, useCanControl } from '../store';
import { bootstrapSpotify } from '../services/connection';
import {
  fetchTrackImage,
  getPlayerState,
  pause,
  playUri,
  resume,
  skipNext,
  skipPrevious,
  subscribeDisconnect,
  subscribePlayerState,
} from '../services/remote';

/**
 * Drives the mini-player: silently re-connects on mount, subscribes to live
 * playback state while the App Remote is bound, lazily fetches album art, and
 * exposes the control callbacks. All subscriptions are torn down on unmount.
 *
 * Controls never throw — a failed transport hiccup is swallowed so the UI can't
 * crash mid-workout. `play()` returns success so the picker can react.
 */
export function useSpotifyPlayback() {
  const playback = useSpotifyStore((s) => s.playback);
  const canControl = useCanControl();
  const remoteConnected = useSpotifyStore((s) => s.remoteConnected);
  const setPlayback = useSpotifyStore((s) => s.setPlayback);
  const setTrackImage = useSpotifyStore((s) => s.setTrackImage);
  const setRemoteConnected = useSpotifyStore((s) => s.setRemoteConnected);
  const setDegradeReason = useSpotifyStore((s) => s.setDegradeReason);

  // Re-establish a prior session once when the screen mounts.
  useEffect(() => {
    void bootstrapSpotify();
  }, []);

  // Subscribe to live state only while the remote is actually bound.
  useEffect(() => {
    if (!remoteConnected) return;
    let active = true;
    void getPlayerState().then((s) => {
      if (active && s) setPlayback(s);
    });
    const offState = subscribePlayerState((s) => setPlayback(s));
    const offDisconnect = subscribeDisconnect(() => {
      setRemoteConnected(false);
      setDegradeReason('remote_failed');
    });
    return () => {
      active = false;
      offState();
      offDisconnect();
    };
  }, [remoteConnected, setPlayback, setRemoteConnected, setDegradeReason]);

  // Fetch album art whenever the track changes and we don't have art yet.
  const lastFetched = useRef<string | null>(null);
  const trackUri = playback?.track?.uri ?? null;
  const hasImage = !!playback?.track?.imageUri;
  useEffect(() => {
    if (!trackUri || hasImage || lastFetched.current === trackUri) return;
    lastFetched.current = trackUri;
    let active = true;
    void fetchTrackImage(trackUri).then((uri) => {
      if (active && uri) setTrackImage(trackUri, uri);
    });
    return () => {
      active = false;
    };
  }, [trackUri, hasImage, setTrackImage]);

  const togglePlay = useCallback(async () => {
    try {
      const pb = useSpotifyStore.getState().playback;
      if (pb?.isPaused) await resume();
      else await pause();
    } catch {
      /* transient — live state will re-sync */
    }
  }, []);

  const next = useCallback(async () => {
    try {
      await skipNext();
    } catch {
      /* ignore */
    }
  }, []);

  const previous = useCallback(async () => {
    try {
      await skipPrevious();
    } catch {
      /* ignore */
    }
  }, []);

  const play = useCallback(async (uri: string): Promise<boolean> => {
    try {
      await playUri(uri);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { playback, canControl, remoteConnected, togglePlay, next, previous, play };
}
