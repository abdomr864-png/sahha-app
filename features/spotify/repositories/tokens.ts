/**
 * Secure persistence for Spotify OAuth tokens. Tokens are secrets, so they
 * live in expo-secure-store (never in MMKV / plain storage) — same policy as
 * the Supabase session (see lib/supabase/storage.ts).
 *
 * Stored as a single JSON blob under one key so read/write/clear is atomic.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SpotifyTokens } from '../types';

const TOKENS_KEY = 'sahha.spotify.tokens.v1';

// SecureStore has no web native module; fall back to localStorage in the
// dev-only web build, mirroring SupabaseSecureStorage.
async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function writeRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
async function deleteRaw(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function isTokens(value: unknown): value is SpotifyTokens {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.accessToken === 'string' &&
    typeof t.refreshToken === 'string' &&
    typeof t.expiresAt === 'number' &&
    typeof t.scope === 'string'
  );
}

export async function loadSpotifyTokens(): Promise<SpotifyTokens | null> {
  try {
    const raw = await readRaw(TOKENS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTokens(parsed) ? parsed : null;
  } catch {
    // Corrupt/unreadable blob — treat as logged out.
    return null;
  }
}

export async function saveSpotifyTokens(tokens: SpotifyTokens): Promise<void> {
  await writeRaw(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearSpotifyTokens(): Promise<void> {
  await deleteRaw(TOKENS_KEY);
}
