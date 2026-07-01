/**
 * Static Spotify integration config. No secrets here — we use the
 * Authorization Code + PKCE flow, so only the public client id ships in the
 * app. If a confidential server exchange is ever added it must live behind a
 * Supabase Edge Function, never in this file.
 */
import Constants from 'expo-constants';

/** Public Spotify client id. Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in your env. */
export const SPOTIFY_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ??
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.SPOTIFY_CLIENT_ID ??
  '';

/**
 * OAuth scopes. Keep in sync with the README + Spotify dashboard.
 *  - user-read-private        → GET /v1/me to read `product` (premium/free).
 *  - user-read-playback-state → read what's currently playing.
 *  - user-modify-playback-state → play/pause/skip via the Web API (fallback).
 *  - playlist-read-private    → list the user's private playlists.
 *  - app-remote-control       → control playback through the App Remote SDK.
 *  - streaming                → required by the App Remote SDK on connect.
 */
export const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'app-remote-control',
  'streaming',
] as const;

/** OAuth endpoints (expo-auth-session `discovery`). */
export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
} as const;

export const SPOTIFY_WEB_API_BASE = 'https://api.spotify.com/v1';

/**
 * Path appended to the app's `sahha://` scheme for the OAuth redirect. The
 * resolved URI (`sahha://spotify-auth`) must be added verbatim to the Spotify
 * dashboard's Redirect URIs.
 */
export const SPOTIFY_REDIRECT_PATH = 'spotify-auth';

/** Deep link that opens the native Spotify app (free-tier fallback). */
export const SPOTIFY_APP_URL = 'spotify://';
/** Store/web fallback when the app isn't installed. */
export const SPOTIFY_INSTALL_URL = 'https://open.spotify.com';

/** Refresh the access token this many ms before it actually expires. */
export const TOKEN_REFRESH_SKEW_MS = 60_000;
