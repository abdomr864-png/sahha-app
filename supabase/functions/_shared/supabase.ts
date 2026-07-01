// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface AuthCtx {
  userId: string;
  jwt: string;
  user: SupabaseClient; // RLS-bound client (acts as the user)
  admin: SupabaseClient; // service-role client (bypasses RLS)
}

export async function authenticate(req: Request): Promise<AuthCtx | Response> {
  const auth = req.headers.get('authorization');
  console.log(
    '[auth] header present:',
    !!auth,
    'starts with bearer:',
    auth?.toLowerCase().startsWith('bearer '),
  );
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    console.log('[auth] reject: missing/malformed Authorization header');
    return new Response(
      JSON.stringify({ error: 'unauthenticated', detail: 'missing_bearer_header' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }
  const jwt = auth.slice(7);
  console.log('[auth] jwt length:', jwt.length, 'first 20 chars:', jwt.slice(0, 20));

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  console.log('[auth] env: url=', !!url, 'anon=', !!anon, 'svc=', !!svc);

  const user = createClient(url, anon, {
    global: { headers: { authorization: auth } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  const { data, error } = await user.auth.getUser();
  if (error || !data?.user) {
    console.log('[auth] reject: getUser failed. error:', error?.message, 'user:', !!data?.user);
    return new Response(
      JSON.stringify({
        error: 'unauthenticated',
        detail: error?.message ?? 'getUser returned no user',
      }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }
  console.log('[auth] OK userId:', data.user.id);
  return { userId: data.user.id, jwt, user, admin };
}
