/* eslint-disable @typescript-eslint/no-explicit-any --
 * `react-native-spotify-remote` is loaded via require() so the JS bundle stays
 * valid where the native module isn't linked (Expo Go, web, tests). The lib's
 * own types aren't imported; instead we cast its `remote` export to the typed
 * `RemoteApi` surface below and never let `any` escape this module. */

import { Platform } from 'react-native';
import type { NowPlayingTrack, PlaybackState } from '../types';

// --- Minimal typed surface of the App Remote SDK we actually use -----------

interface RawImageUri {
  raw: string;
}
interface RawTrack {
  uri: string;
  name: string;
  artist: { name: string };
  album: { name: string };
  duration: number;
  imageUri: RawImageUri;
}
interface RawPlayerState {
  isPaused: boolean;
  playbackPosition: number;
  track: RawTrack | null;
}
interface RemoteSubscription {
  remove: () => void;
}
interface RemoteApi {
  connect(token: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnectedAsync(): Promise<boolean>;
  playUri(uri: string): Promise<void>;
  resume(): Promise<void>;
  pause(): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  getPlayerState(): Promise<RawPlayerState | null>;
  getImage(uri: RawImageUri, options?: { width: number; height: number }): Promise<string>;
  addListener(
    event: string,
    cb: (...args: any[]) => void,
  ): RemoteSubscription | Promise<RemoteSubscription>;
}

let cached: RemoteApi | null | undefined;
function loadRemote(): RemoteApi | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') {
    cached = null;
    return cached;
  }
  try {
    const mod = require('react-native-spotify-remote');
    cached = (mod?.remote ?? null) as RemoteApi | null;
  } catch {
    cached = null;
  }
  return cached;
}

/** True when the native App Remote module is linked (i.e. a dev/EAS build). */
export function isRemoteAvailable(): boolean {
  return loadRemote() !== null;
}

/**
 * Connect the App Remote to the running Spotify app using an OAuth access
 * token. Throws when the module is missing or Spotify isn't installed/running
 * — callers translate that into the free / no-app fallback.
 */
export async function connectRemote(accessToken: string): Promise<void> {
  const remote = loadRemote();
  if (!remote) throw new Error('remote_unavailable');
  await remote.connect(accessToken);
}

export async function disconnectRemote(): Promise<void> {
  const remote = loadRemote();
  if (!remote) return;
  try {
    await remote.disconnect();
  } catch {
    // Best-effort teardown — never throw on cleanup.
  }
}

export async function isRemoteConnected(): Promise<boolean> {
  const remote = loadRemote();
  if (!remote) return false;
  try {
    return await remote.isConnectedAsync();
  } catch {
    return false;
  }
}

// --- Playback controls (no-op when unavailable so callers can't crash) ------

async function safeCall(fn: (r: RemoteApi) => Promise<void>): Promise<void> {
  const remote = loadRemote();
  if (!remote) return;
  await fn(remote);
}

export const playUri = (uri: string) => safeCall((r) => r.playUri(uri));
export const resume = () => safeCall((r) => r.resume());
export const pause = () => safeCall((r) => r.pause());
export const skipNext = () => safeCall((r) => r.skipToNext());
export const skipPrevious = () => safeCall((r) => r.skipToPrevious());

// --- Player state ----------------------------------------------------------

function normalizeTrack(track: RawTrack | null): NowPlayingTrack | null {
  if (!track) return null;
  return {
    uri: track.uri,
    name: track.name,
    artist: track.artist?.name ?? '',
    albumName: track.album?.name ?? '',
    imageUri: null, // album art is fetched lazily — see fetchTrackImage
    durationMs: track.duration ?? 0,
  };
}

function normalizeState(raw: RawPlayerState | null): PlaybackState | null {
  if (!raw) return null;
  return {
    track: normalizeTrack(raw.track),
    isPaused: raw.isPaused,
    positionMs: raw.playbackPosition ?? 0,
  };
}

export async function getPlayerState(): Promise<PlaybackState | null> {
  const remote = loadRemote();
  if (!remote) return null;
  try {
    return normalizeState(await remote.getPlayerState());
  } catch {
    return null;
  }
}

/**
 * Album art is delivered by the SDK as a base64 blob fetched on demand from a
 * track's opaque imageUri. Returns a `data:` URI usable directly in <Image>,
 * or null on any failure (we just render the placeholder).
 */
export async function fetchTrackImage(trackUri: string): Promise<string | null> {
  const remote = loadRemote();
  if (!remote) return null;
  try {
    const raw = await remote.getPlayerState();
    if (!raw?.track || raw.track.uri !== trackUri) return null;
    const base64 = await remote.getImage(raw.track.imageUri, { width: 200, height: 200 });
    return base64 ? `data:image/jpeg;base64,${base64}` : null;
  } catch {
    return null;
  }
}

type StateListener = (state: PlaybackState | null) => void;
type VoidListener = () => void;

/**
 * Subscribe to live playback state. Returns an unsubscribe fn that is safe to
 * call even if the underlying subscription resolved asynchronously or never
 * attached (module missing).
 */
export function subscribePlayerState(cb: StateListener): () => void {
  const remote = loadRemote();
  if (!remote) return () => {};
  let sub: RemoteSubscription | null = null;
  let cancelled = false;
  const handle = remote.addListener('playerStateChanged', (state: RawPlayerState) => {
    cb(normalizeState(state));
  });
  Promise.resolve(handle).then((s) => {
    if (cancelled) s.remove();
    else sub = s;
  });
  return () => {
    cancelled = true;
    sub?.remove();
  };
}

/** Subscribe to remote disconnect (Spotify closed / lost). */
export function subscribeDisconnect(cb: VoidListener): () => void {
  const remote = loadRemote();
  if (!remote) return () => {};
  let sub: RemoteSubscription | null = null;
  let cancelled = false;
  const handle = remote.addListener('remoteDisconnected', () => cb());
  Promise.resolve(handle).then((s) => {
    if (cancelled) s.remove();
    else sub = s;
  });
  return () => {
    cancelled = true;
    sub?.remove();
  };
}
