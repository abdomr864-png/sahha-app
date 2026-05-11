// Edge Function: delete the calling user. Profile + training rows cascade
// via FK constraints on `profiles.user_id references auth.users on delete
// cascade`. Storage objects (progress photos, form-check videos) are tied
// off by separate cleanup functions / pg_cron (see DECISIONS.md / D22).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-client-info, x-client, apikey',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  console.log('[delete-account] hit', { method: req.method, url: req.url });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log('[delete-account] reject: not POST');
    return new Response('method_not_allowed', { status: 405, headers: corsHeaders });
  }

  const auth = req.headers.get('authorization');
  console.log('[delete-account] auth header present:', !!auth);
  if (!auth) return json({ error: 'unauthenticated' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  console.log('[delete-account] env:', {
    url: !!supabaseUrl,
    anon: !!anonKey,
    svc: !!serviceKey,
  });

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json(
      { error: 'missing_env', detail: { url: !!supabaseUrl, anon: !!anonKey, svc: !!serviceKey } },
      500,
    );
  }

  // Pass the JWT explicitly: getUser() with no args reads from local session
  // storage (which doesn't exist in an Edge Function), not from the global
  // Authorization header. We strip the "Bearer " prefix if present.
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data?.user) {
    console.log('[delete-account] getUser failed:', error?.message);
    return json({ error: 'unauthenticated', detail: error?.message }, 401);
  }
  console.log('[delete-account] user:', data.user.id);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) {
    console.log('[delete-account] deleteUser failed:', delErr.message);
    return json({ error: 'delete_failed', detail: delErr.message }, 500);
  }

  console.log('[delete-account] OK', data.user.id);
  return json({ ok: true });
});
