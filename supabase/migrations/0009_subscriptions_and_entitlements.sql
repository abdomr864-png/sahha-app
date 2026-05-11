-- Subscriptions, usage counters, entitlement remote config

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan sub_plan not null default 'free',
  status subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  provider_customer_id text,
  updated_at timestamptz not null default now()
);
create unique index if not exists sub_user_unique on subscriptions (user_id);
alter table subscriptions enable row level security;
drop policy if exists sub_self_read on subscriptions;
create policy sub_self_read on subscriptions
  for select using (user_id = auth.uid());
-- writes only via service role / webhook; authenticated cannot insert/update/delete.

drop trigger if exists sub_set_updated_at on subscriptions;
create trigger sub_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create table if not exists usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  period_start date not null,
  count int not null default 0,
  unique (user_id, feature, period_start)
);
create index if not exists uc_user_feature_idx on usage_counters (user_id, feature, period_start desc);
alter table usage_counters enable row level security;
drop policy if exists uc_self_read on usage_counters;
create policy uc_self_read on usage_counters
  for select using (user_id = auth.uid());
-- writes only via edge functions (service role).

-- Remote config for entitlements (public read)
create table if not exists entitlement_rules (
  feature text primary key,
  free_daily_limit int,
  free_total_limit int,
  premium_only boolean not null default false,
  description text
);
alter table entitlement_rules enable row level security;
drop policy if exists er_read_all on entitlement_rules;
create policy er_read_all on entitlement_rules for select using (true);

insert into entitlement_rules (feature, free_daily_limit, free_total_limit, premium_only, description) values
  ('ai_messages', 5, null, false, 'AI coach chat messages per day'),
  ('form_check', 1, null, false, 'Form-check video uploads per week (rate limited as 1/week, encoded as 1/day with weekly window in code)'),
  ('active_programs', null, 1, false, 'Concurrent active programs'),
  ('progress_photos', null, 3, false, 'Progress photos per month (rolling 30 days)'),
  ('ai_generated_program', null, null, true, 'AI-generated personalized programs'),
  ('voice_chat', null, null, true, 'Voice chat with AI coach'),
  ('advanced_analytics', null, null, true, 'Volume per muscle, plateau detection, trends')
on conflict (feature) do nothing;
