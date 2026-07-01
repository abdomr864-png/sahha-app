-- Plans catalog + admin plan management
--
-- Adds a `plans` table so the price, copy, and per-feature limits of each
-- subscription tier are editable from the admin panel (instead of being
-- hard-coded in the mobile paywall). Also adds an admin RPC to grant a user a
-- plan by email or name, which upserts their `subscriptions` row.

-- ── plans catalog ──────────────────────────────────────────────────────────
create table if not exists plans (
  id               text primary key,                 -- slug, e.g. 'pro' | 'elite' | 'lifetime'
  name             text not null,
  description      text,
  price            numeric(10, 2) not null default 0,
  currency         text not null default 'USD',
  billing_interval text not null default 'year',      -- 'month' | 'year' | 'one_time'
  -- Which subscriptions.plan enum this tier grants when purchased/assigned.
  sub_plan         sub_plan,
  -- Marketing copy: list of feature bullet strings shown on the paywall.
  features         jsonb not null default '[]'::jsonb,
  -- Per-feature usage limits for this plan, e.g. {"ai_messages": 50}.
  -- Informational/admin-managed; null value = unlimited.
  feature_limits   jsonb not null default '{}'::jsonb,
  badge            text,
  highlight        boolean not null default false,
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table plans enable row level security;
-- Public read so the paywall (anon/auth client) can fetch live prices.
drop policy if exists plans_read_all on plans;
create policy plans_read_all on plans for select using (true);

drop trigger if exists plans_set_updated_at on plans;
create trigger plans_set_updated_at before update on plans
  for each row execute function set_updated_at();

-- Admin can do anything on plans (additive to the public read policy).
drop policy if exists admin_all on plans;
create policy admin_all on plans for all to authenticated
  using (is_admin()) with check (is_admin());

-- Seed the three tiers currently hard-coded in app/paywall.tsx.
insert into plans (id, name, description, price, currency, billing_interval, sub_plan, features, badge, highlight, sort_order) values
  ('pro', 'Pro', 'or $11.99 / mo · 7-day trial', 71.99, 'USD', 'year', 'premium_yearly',
    '["Full recovery: HRV + ACWR","Strength levels & badges","Apple Watch app","Unlimited history + analytics"]'::jsonb,
    null, false, 0),
  ('elite', 'Elite', 'or $19.99 / mo · 7-day trial', 119.99, 'USD', 'year', 'premium_yearly',
    '["Everything in Pro","Unlimited AI coach & chat","Equipment scan, form check & meal AI","Adaptive AI programs"]'::jsonb,
    'Most popular', true, 1),
  ('lifetime', 'Lifetime', 'Pay once · keep forever', 199.99, 'USD', 'one_time', 'premium_yearly',
    '["Everything in Elite, forever","AI fair-use included","All future updates"]'::jsonb,
    null, false, 2)
on conflict (id) do nothing;

-- ── admin_grant_plan: assign a user a plan by email or name ──────────────────
-- Resolves a user from an email (exact, case-insensitive) or a username /
-- display name (case-insensitive contains), then upserts their subscription.
-- Returns a jsonb result describing the outcome.
create or replace function admin_grant_plan(
  p_query      text,
  p_plan       sub_plan,
  p_status     subscription_status default 'active',
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query    text := trim(p_query);
  v_user_id  uuid;
  v_email    text;
  v_matches  int;
begin
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_query is null or v_query = '' then
    return jsonb_build_object('ok', false, 'error', 'empty_query');
  end if;

  -- 1) exact email match
  select u.id, u.email into v_user_id, v_email
  from auth.users u
  where lower(u.email) = lower(v_query)
  limit 1;

  -- 2) fall back to username / display name (contains)
  if v_user_id is null then
    select count(*) into v_matches
    from auth.users u
    left join profiles p on p.user_id = u.id
    where p.username ilike '%' || v_query || '%'
       or p.display_name ilike '%' || v_query || '%';

    if v_matches = 0 then
      return jsonb_build_object('ok', false, 'error', 'not_found');
    elsif v_matches > 1 then
      return jsonb_build_object('ok', false, 'error', 'ambiguous', 'matches', v_matches);
    end if;

    select u.id, u.email into v_user_id, v_email
    from auth.users u
    left join profiles p on p.user_id = u.id
    where p.username ilike '%' || v_query || '%'
       or p.display_name ilike '%' || v_query || '%'
    limit 1;
  end if;

  -- Upsert the subscription (one row per user; unique index on user_id).
  insert into subscriptions (user_id, plan, status, started_at, expires_at, updated_at)
  values (v_user_id, p_plan, p_status, now(), p_expires_at, now())
  on conflict (user_id) do update set
    plan       = excluded.plan,
    status     = excluded.status,
    expires_at = excluded.expires_at,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'email', v_email,
    'plan', p_plan,
    'status', p_status,
    'expires_at', p_expires_at
  );
end;
$$;

grant execute on function admin_grant_plan(text, sub_plan, subscription_status, timestamptz) to authenticated;
