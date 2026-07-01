/**
 * Connection orchestration — the one place that sequences OAuth → product
 * detection → App Remote binding and writes the resulting state into the
 * store. Functions operate on `useSpotifyStore.getState()` so they're usable
 * outside React (hooks just call them). Nothing here throws: every failure
 * path resolves to a `status` + `degradeReason` the UI can render.
 */
import { AppError } from '@lib/supabase/errors';
import { SPOTIFY_CLIENT_ID } from '../config';
import { useSpotifyStore } from '../store';
import { fetchSpotifyUser } from '../repositories/webApi';
import { authorizeSpotify } from './auth';
import { clearTokens, getFreshAccessToken, hasStoredTokens, persistTokens } from './token-manager';
import { connectRemote, disconnectRemote, isRemoteAvailable } from './remote';

const store = () => useSpotifyStore.getState();

export function isSpotifyConfigured(): boolean {
  return !!SPOTIFY_CLIENT_ID;
}

/**
 * Shared tail of both connect() and bootstrap(): we already hold valid tokens,
 * so detect the product type and (for premium) bind the App Remote.
 */
async function finalizeConnection(): Promise<void> {
  const s = store();

  let user;
  try {
    user = await fetchSpotifyUser();
  } catch (e) {
    const isNetwork = e instanceof AppError && e.code === 'network';
    s.setStatus('error');
    s.setDegradeReason(isNetwork ? 'network' : 'token_expired');
    return;
  }

  s.setProduct(user.product);
  s.setAccount({
    id: user.id,
    displayName: user.display_name,
    imageUri: user.images[0]?.url ?? null,
  });

  // Free accounts: no in-app control, surface the "Open Spotify" fallback.
  if (user.product !== 'premium') {
    s.setRemoteConnected(false);
    s.setDegradeReason('free_account');
    s.setStatus('connected');
    return;
  }

  // Premium but the native module isn't linked (shouldn't happen in EAS builds).
  if (!isRemoteAvailable()) {
    s.setRemoteConnected(false);
    s.setDegradeReason('app_not_installed');
    s.setStatus('connected');
    return;
  }

  // Premium: try to bind the App Remote to the installed Spotify app.
  try {
    const token = await getFreshAccessToken();
    await connectRemote(token);
    s.setRemoteConnected(true);
    s.setDegradeReason(null);
    s.setStatus('connected');
  } catch {
    // Most common cause: Spotify app not installed / not running. We stay
    // "connected" (Web API works) but degrade controls to the deep-link.
    s.setRemoteConnected(false);
    s.setDegradeReason('app_not_installed');
    s.setStatus('connected');
  }
}

/** Interactive connect — drives the OAuth consent screen. */
export async function connectSpotify(): Promise<void> {
  const s = store();
  if (!isSpotifyConfigured()) {
    s.setStatus('error');
    s.setDegradeReason('unconfigured');
    return;
  }
  s.setStatus('connecting');
  s.setDegradeReason(null);

  const result = await authorizeSpotify();
  if (!result.ok) {
    // Cancelling isn't an error state — just stay disconnected.
    s.setStatus(result.reason === 'auth_denied' ? 'disconnected' : 'error');
    s.setDegradeReason(result.reason);
    return;
  }

  await persistTokens(result.tokens);
  await finalizeConnection();
}

/** Silent re-connect on app/session mount when tokens already exist. */
export async function bootstrapSpotify(): Promise<void> {
  const s = store();
  if (s.status === 'connected' || s.status === 'connecting') return;
  if (!isSpotifyConfigured()) return;
  if (!(await hasStoredTokens())) return;
  s.setStatus('connecting');
  await finalizeConnection();
}

/** Full teardown: unbind remote, wipe tokens, reset store (keeps prompt flag). */
export async function disconnectSpotify(): Promise<void> {
  await disconnectRemote();
  await clearTokens();
  useSpotifyStore.getState().reset();
}
