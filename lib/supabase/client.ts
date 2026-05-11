import 'react-native-url-polyfill/auto';
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

export type Tables = Database['public']['Tables'];
export type Row<K extends keyof Tables> = Tables[K]['Row'];
export type Insert<K extends keyof Tables> = Tables[K]['Insert'];
export type Update<K extends keyof Tables> = Tables[K]['Update'];
