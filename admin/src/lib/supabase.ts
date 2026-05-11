import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anon);

if (!isConfigured) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env');
}

// createClient throws if url/anon are empty. Pass safe placeholders so module
// load never fails — the app surfaces a setup screen instead of going blank.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sahha-admin-auth',
    },
  },
);
