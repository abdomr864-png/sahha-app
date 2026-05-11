import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase auth storage backed by expo-secure-store on native.
 * SecureStore is appropriate for tokens (small, secret).
 * Workout/in-progress state must use MMKV instead — see lib/offline/storage.ts.
 *
 * Web has no SecureStore native module; fall back to localStorage for the dev
 * build. Production target is mobile (see D3); web is dev-only.
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

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

export const SupabaseSecureStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
