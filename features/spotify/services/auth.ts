/**
 * Spotify OAuth 2.0 — Authorization Code flow with PKCE (no client secret in
 * the app). Built on expo-auth-session for the interactive grant, with a hand
 * -rolled token exchange / refresh so we own the parsing into `SpotifyTokens`.
 *
 * The access token returned here is what both the Web API service and the App
 * Remote SDK consume. Refresh is silent: callers go through
 * `getFreshAccessToken()` (see ./token-manager) which refreshes on demand.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_DISCOVERY,
  SPOTIFY_REDIRECT_PATH,
  SPOTIFY_SCOPES,
} from '../config';
import type { SpotifyDegradeReason, SpotifyTokenResponse, SpotifyTokens } from '../types';

// Dismisses the auth popup and resolves the redirect cleanly (no-op on native
// custom-scheme flows, required for the web fallback).
WebBrowser.maybeCompleteAuthSession();

export type SpotifyAuthResult =
  | { ok: true; tokens: SpotifyTokens }
  | { ok: false; reason: SpotifyDegradeReason };

/** Resolved redirect URI — must be registered verbatim in the Spotify dashboard. */
export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'sahha', path: SPOTIFY_REDIRECT_PATH });
}

function tokensFromResponse(res: SpotifyTokenResponse, prevRefresh?: string): SpotifyTokens {
  return {
    accessToken: res.access_token,
    // Spotify omits refresh_token on refresh when it's unchanged — keep the old one.
    refreshToken: res.refresh_token ?? prevRefresh ?? '',
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope,
  };
}

/**
 * Drives the interactive consent screen, then exchanges the code for tokens.
 * Never throws — every failure path resolves to a typed `reason`.
 */
export async function authorizeSpotify(): Promise<SpotifyAuthResult> {
  if (!SPOTIFY_CLIENT_ID) return { ok: false, reason: 'unconfigured' };

  const redirectUri = getRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: SPOTIFY_CLIENT_ID,
    scopes: [...SPOTIFY_SCOPES],
    redirectUri,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
  });

  let result: AuthSession.AuthSessionResult;
  try {
    result = await request.promptAsync(SPOTIFY_DISCOVERY);
  } catch {
    return { ok: false, reason: 'unknown' };
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, reason: 'auth_denied' };
  }
  if (result.type === 'error' || result.type !== 'success') {
    const err = result.type === 'error' ? result.error?.code : undefined;
    return { ok: false, reason: err === 'access_denied' ? 'auth_denied' : 'unknown' };
  }

  const code = result.params.code;
  const verifier = request.codeVerifier;
  if (!code || !verifier) return { ok: false, reason: 'unknown' };

  try {
    const res = await exchangeToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: SPOTIFY_CLIENT_ID,
      code_verifier: verifier,
    });
    return { ok: true, tokens: tokensFromResponse(res) };
  } catch (e) {
    return { ok: false, reason: reasonFromExchangeError(e) };
  }
}

/**
 * Silent refresh. Throws a tagged error (`{ reason }`) so the token manager can
 * distinguish "re-auth needed" from a transient network failure.
 */
export async function refreshSpotifyTokens(refreshToken: string): Promise<SpotifyTokens> {
  if (!SPOTIFY_CLIENT_ID) throw { reason: 'unconfigured' as SpotifyDegradeReason };
  if (!refreshToken) throw { reason: 'token_expired' as SpotifyDegradeReason };
  try {
    const res = await exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: SPOTIFY_CLIENT_ID,
    });
    return tokensFromResponse(res, refreshToken);
  } catch (e) {
    throw { reason: reasonFromExchangeError(e) };
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

class TokenExchangeError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`spotify token exchange failed (${status})`);
    this.name = 'TokenExchangeError';
  }
}

async function exchangeToken(params: Record<string, string>): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(SPOTIFY_DISCOVERY.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new TokenExchangeError(res.status, text);
  }
  return (await res.json()) as SpotifyTokenResponse;
}

function reasonFromExchangeError(e: unknown): SpotifyDegradeReason {
  if (e instanceof TokenExchangeError) {
    // 400 invalid_grant → refresh token revoked/expired → must re-auth.
    if (e.status === 400 || e.status === 401) return 'token_expired';
    return 'unknown';
  }
  // fetch throws TypeError on RN when offline.
  if (e instanceof TypeError) return 'network';
  return 'unknown';
}
