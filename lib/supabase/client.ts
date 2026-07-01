import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { SupabaseSecureStorage } from './storage';
import type { Database } from './database.types';

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.SUPABASE_URL ??
  '';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.SUPABASE_ANON_KEY ??
  '';

if (!url || !anonKey) {
  // Surface this once at boot, not on every call.
  console.warn(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — auth and queries will fail.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: {
    storage: SupabaseSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-client': 'sahha-mobile' },
  },
});

// Drive token auto-refresh off foreground state (Supabase's recommended RN
// setup). `autoRefreshToken` only runs its timer while started; tie it to the
// app being active so a long-foregrounded session refreshes its access token
// before it expires instead of silently lapsing. getSession() on next launch
// still restores + refreshes from the persisted (chunked) session regardless.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

export type Tables = Database['public']['Tables'];
export type Row<K extends keyof Tables> = Tables[K]['Row'];
export type Insert<K extends keyof Tables> = Tables[K]['Insert'];
export type Update<K extends keyof Tables> = Tables[K]['Update'];
