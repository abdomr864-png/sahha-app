/**
 * Central authority for the live Spotify access token. Everything that calls
 * Spotify (Web API service, App Remote connect) goes through
 * `getFreshAccessToken()` so refresh logic lives in exactly one place.
 *
 *  - Caches the token bundle in memory to avoid a SecureStore read per call.
 *  - Refreshes when within TOKEN_REFRESH_SKEW_MS of expiry.
 *  - Single-flights concurrent refreshes (many callers, one network round-trip).
 *  - On unrecoverable refresh failure (revoked token) clears storage and throws
 *    a tagged `{ reason }` so the caller can drop to a re-auth state.
 */
import { TOKEN_REFRESH_SKEW_MS } from '../config';
import type { SpotifyDegradeReason, SpotifyTokens } from '../types';
import { clearSpotifyTokens, loadSpotifyTokens, saveSpotifyTokens } from '../repositories/tokens';
import { refreshSpotifyTokens } from './auth';

export interface TaggedError {
  reason: SpotifyDegradeReason;
}
function isTagged(e: unknown): e is TaggedError {
  return typeof e === 'object' && e !== null && 'reason' in e;
}

let cached: SpotifyTokens | null | undefined; // undefined = not yet hydrated
let inFlight: Promise<SpotifyTokens> | null = null;

function isExpired(t: SpotifyTokens): boolean {
  return Date.now() >= t.expiresAt - TOKEN_REFRESH_SKEW_MS;
}

/** Seed the in-memory cache after an interactive authorize() so the first call is hot. */
export async function persistTokens(tokens: SpotifyTokens): Promise<void> {
  cached = tokens;
  await saveSpotifyTokens(tokens);
}

export async function hasStoredTokens(): Promise<boolean> {
  if (cached === undefined) cached = await loadSpotifyTokens();
  return !!cached;
}

/**
 * Returns a valid access token, refreshing if needed. Throws `{ reason }` when
 * there is no usable token (never authed, or refresh permanently failed).
 */
export async function getFreshAccessToken(): Promise<string> {
  if (cached === undefined) cached = await loadSpotifyTokens();
  if (!cached) throw { reason: 'token_expired' as SpotifyDegradeReason };
  if (!isExpired(cached)) return cached.accessToken;

  // Coalesce concurrent refreshes.
  if (!inFlight) {
    const refreshToken = cached.refreshToken;
    inFlight = refreshSpotifyTokens(refreshToken)
      .then(async (next) => {
        await persistTokens(next);
        return next;
      })
      .catch(async (e: unknown) => {
        // A revoked/expired refresh token is terminal — wipe and force re-auth.
        if (isTagged(e) && e.reason === 'token_expired') {
          await clearTokens();
        }
        throw e;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  const fresh = await inFlight;
  return fresh.accessToken;
}

export async function clearTokens(): Promise<void> {
  cached = null;
  inFlight = null;
  await clearSpotifyTokens();
}
