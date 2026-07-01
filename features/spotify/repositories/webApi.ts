/**
 * Typed Spotify Web API client. Used for everything the App Remote SDK can't
 * give us: the user's `product` (premium detection) and their playlist library.
 *
 * Every call funnels through `apiFetch`, which injects a fresh bearer token and
 * maps failures onto the app-wide `AppError` so the existing ErrorMessage /
 * i18n plumbing renders them.
 */
import { AppError } from '@lib/supabase/errors';
import { SPOTIFY_WEB_API_BASE } from '../config';
import type { SpotifyPaging, SpotifyPlaylist, SpotifyUser } from '../types';
import { getFreshAccessToken } from '../services/token-manager';

async function apiFetch<T>(path: string, retryOn401 = true): Promise<T> {
  let token: string;
  try {
    token = await getFreshAccessToken();
  } catch {
    throw new AppError('unauthenticated');
  }

  let res: Response;
  try {
    res = await fetch(`${SPOTIFY_WEB_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // fetch throws on offline.
    throw new AppError('network');
  }

  if (res.status === 401 && retryOn401) {
    // Token may have been revoked between refresh and use — try exactly once more.
    return apiFetch<T>(path, false);
  }
  if (res.status === 401) throw new AppError('unauthenticated');
  if (res.status === 429) throw new AppError('rate_limited');
  if (!res.ok) throw new AppError('unknown');

  return (await res.json()) as T;
}

export async function fetchSpotifyUser(): Promise<SpotifyUser> {
  return apiFetch<SpotifyUser>('/me');
}

/**
 * The current user's playlists (first page is enough for a picker — 50 max).
 * Filters out the rare null entries Spotify can return for unavailable items.
 */
export async function fetchUserPlaylists(limit = 50): Promise<SpotifyPlaylist[]> {
  const page = await apiFetch<SpotifyPaging<SpotifyPlaylist | null>>(
    `/me/playlists?limit=${limit}`,
  );
  return page.items.filter((p): p is SpotifyPlaylist => p !== null);
}
