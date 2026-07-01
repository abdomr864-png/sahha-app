import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase auth storage backed by expo-secure-store on native.
 * SecureStore is appropriate for tokens (small, secret).
 * Workout/in-progress state must use MMKV instead — see lib/offline/storage.ts.
 *
 * Web has no SecureStore native module; fall back to localStorage for the dev
 * build. Production target is mobile (see D3); web is dev-only.
 *
 * ── Why chunking ────────────────────────────────────────────────────────────
 * SecureStore enforces a hard ~2048-byte limit per value. A persisted Supabase
 * session (access JWT + refresh token + the user object, including
 * app_metadata / user_metadata) routinely exceeds that. When it does,
 * setItemAsync warns and FAILS to write on native — so on the next launch
 * getSession() finds nothing and the user is forced to log in every time.
 *
 * We work around it by splitting the value into <2KB chunks stored under
 * `${key}.0`, `${key}.1`, … with the chunk count in `${key}.__n`. This keeps
 * the tokens encrypted in the keychain/keystore (the original intent) while
 * removing the size ceiling. Reads transparently reassemble, and legacy
 * single-key values written before this change are still honoured.
 */
const webStorage = {
  async getItem(key: string): Promise<string | null> {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    globalThis.localStorage?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    globalThis.localStorage?.removeItem(key);
  },
};

// Stay comfortably under SecureStore's 2048-byte cap (tokens are ASCII, so one
// char ≈ one byte; the margin also covers any per-entry overhead).
const CHUNK_SIZE = 1800;
const metaKey = (key: string) => `${key}.__n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

function splitChunks(value: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [''];
}

async function readChunkCount(key: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(metaKey(key));
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

async function deleteChunks(key: string, count: number): Promise<void> {
  const deletions: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  }
  await Promise.all(deletions);
}

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);

    // No chunk metadata → either nothing stored, or a legacy single-key value
    // written before chunking. Fall back to the plain key for backward compat.
    if (count == null) {
      return SecureStore.getItemAsync(key);
    }

    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    // A missing chunk means the stored value is corrupt/partial; treat as absent
    // so the next write re-persists a clean copy.
    if (parts.some((p) => p == null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = (await readChunkCount(key)) ?? 0;
    const chunks = splitChunks(value);

    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    await SecureStore.setItemAsync(metaKey(key), String(chunks.length));

    // Remove any now-orphaned chunks from a previously longer value, plus any
    // legacy single-key copy so reads don't pick up stale data.
    for (let i = chunks.length; i < previousCount; i += 1) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
    await SecureStore.deleteItemAsync(key);
  },

  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key);
    if (count != null) {
      await deleteChunks(key, count);
      await SecureStore.deleteItemAsync(metaKey(key));
    }
    // Also clear any legacy single-key value.
    await SecureStore.deleteItemAsync(key);
  },
};

export const SupabaseSecureStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
