/**
 * Strongly-typed Spotify Web API responses (only the subset Sahha consumes)
 * plus the shapes our store and services exchange. No `any`.
 */

// ---------------------------------------------------------------------------
// Token bundle (persisted in expo-secure-store)
// ---------------------------------------------------------------------------

export interface SpotifyTokens {
  accessToken: string;
  /** Spotify does not always return a new refresh token on refresh. */
  refreshToken: string;
  /** Absolute epoch-ms expiry, computed from `expires_in` at grant time. */
  expiresAt: number;
  scope: string;
}

/** Raw token endpoint payload (snake_case as Spotify returns it). */
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

// ---------------------------------------------------------------------------
// Web API: /v1/me
// ---------------------------------------------------------------------------

export type SpotifyProduct = 'premium' | 'free' | 'open';

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  /** `premium` unlocks in-app playback control; everything else degrades. */
  product: SpotifyProduct;
  images: SpotifyImage[];
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

// ---------------------------------------------------------------------------
// Web API: /v1/me/playlists
// ---------------------------------------------------------------------------

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  description: string | null;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string | null };
}

export interface SpotifyPaging<T> {
  items: T[];
  next: string | null;
  total: number;
}

// ---------------------------------------------------------------------------
// Normalized playback state (what the UI renders, source-agnostic)
// ---------------------------------------------------------------------------

export interface NowPlayingTrack {
  /** Spotify URI, e.g. `spotify:track:...`. */
  uri: string;
  name: string;
  artist: string;
  albumName: string;
  /** Best-fit album art URL, or null when unavailable. */
  imageUri: string | null;
  durationMs: number;
}

export interface PlaybackState {
  track: NowPlayingTrack | null;
  isPaused: boolean;
  positionMs: number;
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

export type SpotifyConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Why the integration is in its current (possibly degraded) state. Drives the
 * UI copy and which fallback we show.
 */
export type SpotifyDegradeReason =
  | 'free_account' // connected, but product !== premium → no in-app control
  | 'app_not_installed' // Spotify app missing → App Remote can't connect
  | 'remote_failed' // App Remote connect/transfer failed
  | 'auth_denied' // user cancelled / denied the OAuth prompt
  | 'token_expired' // refresh failed, need to re-auth
  | 'network' // network loss
  | 'unconfigured' // missing client id
  | 'unknown';
