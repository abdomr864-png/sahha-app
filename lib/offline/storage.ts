/**
 * Fast synchronous KV store for non-secret persisted state:
 *  - in-progress workout session
 *  - offline operation queue
 *  - cached entitlement rules
 *  - i18n locale preference
 *  - onboarding draft
 *
 * Secrets (auth tokens) belong in expo-secure-store, not here.
 *
 * Backends, in order of preference:
 *  1. react-native-mmkv — fastest, used in dev clients / production builds.
 *  2. expo-secure-store — sync API, persists in Expo Go where MMKV's native
 *     module is unavailable. ~2KB per item Android limit; we keep values
 *     small.
 *  3. In-memory Map — last resort if neither lib is wired (web, tests).
 */

type KVBackend = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  contains(key: string): boolean;
  clearAll(): void;
};

// expo-secure-store keys must match /^[A-Za-z0-9._-]+$/. Our keys already
// follow that, but sanitize defensively in case a caller passes something else.
function sanitizeKey(k: string): string {
  return k.replace(/[^A-Za-z0-9._-]/g, '_');
}

function tryMMKV(): KVBackend | null {
  try {
    const { MMKV } = require('react-native-mmkv');
    const mmkv = new MMKV({ id: 'sahha.default' });
    return {
      getString: (k) => mmkv.getString(k),
      set: (k, v) => mmkv.set(k, v),
      delete: (k) => mmkv.delete(k),
      contains: (k) => mmkv.contains(k),
      clearAll: () => mmkv.clearAll(),
    };
  } catch {
    return null;
  }
}

function trySecureStore(): KVBackend | null {
  try {
    const SecureStore = require('expo-secure-store');
    if (typeof SecureStore.getItem !== 'function') return null;
    // Track keys so we can implement contains/clearAll without an
    // index API. Hydrate on first use from a manifest blob.
    const MANIFEST_KEY = 'sahha._manifest';
    const known = new Set<string>();
    try {
      const raw = SecureStore.getItem(MANIFEST_KEY) as string | null;
      if (raw) for (const k of JSON.parse(raw)) known.add(k);
    } catch {
      /* ignore */
    }
    const persistManifest = () => {
      try {
        SecureStore.setItem(MANIFEST_KEY, JSON.stringify(Array.from(known)));
      } catch {
        /* ignore */
      }
    };
    return {
      getString: (k) => {
        try {
          const v = SecureStore.getItem(sanitizeKey(k)) as string | null;
          return v ?? undefined;
        } catch {
          return undefined;
        }
      },
      set: (k, v) => {
        try {
          SecureStore.setItem(sanitizeKey(k), v);
          if (!known.has(k)) {
            known.add(k);
            persistManifest();
          }
        } catch {
          /* ignore */
        }
      },
      delete: (k) => {
        try {
          // SDK 54 ships a sync deleteItem; fall back to async if absent.
          if (typeof SecureStore.deleteItem === 'function') {
            SecureStore.deleteItem(sanitizeKey(k));
          } else {
            void SecureStore.deleteItemAsync(sanitizeKey(k)).catch(() => undefined);
          }
          if (known.delete(k)) persistManifest();
        } catch {
          /* ignore */
        }
      },
      contains: (k) => {
        try {
          return SecureStore.getItem(sanitizeKey(k)) != null;
        } catch {
          return false;
        }
      },
      clearAll: () => {
        for (const k of Array.from(known)) {
          try {
            if (typeof SecureStore.deleteItem === 'function') {
              SecureStore.deleteItem(sanitizeKey(k));
            } else {
              void SecureStore.deleteItemAsync(sanitizeKey(k)).catch(() => undefined);
            }
          } catch {
            /* ignore */
          }
        }
        known.clear();
        persistManifest();
      },
    };
  } catch {
    return null;
  }
}

function memoryBackend(): KVBackend {
  const map = new Map<string, string>();
  return {
    getString: (k) => map.get(k),
    set: (k, v) => {
      map.set(k, v);
    },
    delete: (k) => {
      map.delete(k);
    },
    contains: (k) => map.has(k),
    clearAll: () => map.clear(),
  };
}

const backend: KVBackend = tryMMKV() ?? trySecureStore() ?? memoryBackend();

export const storage = {
  getString(key: string): string | undefined {
    return backend.getString(key);
  },
  setString(key: string, value: string): void {
    backend.set(key, value);
  },
  getJSON<T>(key: string): T | undefined {
    const raw = backend.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },
  setJSON<T>(key: string, value: T): void {
    backend.set(key, JSON.stringify(value));
  },
  delete(key: string): void {
    backend.delete(key);
  },
  contains(key: string): boolean {
    return backend.contains(key);
  },
  clear(): void {
    backend.clearAll();
  },
};
