-- AI call logs (cost monitoring + abuse detection) and the new entitlement
-- rules for the OpenAI-backed AI features. See DECISIONS.md / D30.

create table if not exists ai_call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd_estimate numeric(10, 6) not null default 0,
  status text not null check (status in ('success', 'error')),
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists ai_call_logs_user_day_idx
  on ai_call_logs (user_id, created_at desc);
create index if not exists ai_call_logs_feature_idx
  on ai_call_logs (feature, created_at desc);

alter table ai_call_logs enable row level security;

drop policy if exists ai_call_logs_self_read on ai_call_logs;
create policy ai_call_logs_self_read on ai_call_logs
  for select using (user_id = auth.uid());
-- writes only via service role (edge functions).

-- Daily rollup. SECURITY INVOKER so RLS still gates per-user reads; admin
-- view bypasses via service role from the admin dashboard endpoint.
create or replace view ai_costs_by_user_daily as
select
  user_id,
  date_trunc('day', created_at) as day,
  count(*) as calls,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens,
  sum(cost_usd_estimate) as cost_usd
from ai_call_logs
group by user_id, day;

-- Admin flag on profiles. Admin-only screens read this.
alter table profiles add column if not exists is_admin boolean not null default false;

-- Entitlement rules for the new spec features. Existing rows are left alone
-- via on conflict do nothing; we replace where the daily limit changed.
insert into entitlement_rules (feature, free_daily_limit, free_total_limit, premium_only, description) values
  ('ai_chat',          5,  null, false, 'AI coach chat messages per day'),
  ('ai_meal_parse',    10, null, false, 'AI meal parses per day'),
  ('ai_program_gen',   null, null, true,  'AI-generated training programs (premium only)'),
  ('ai_form_check',    1,  null, false, 'AI form-check video analyses per week (encoded as 1/day; weekly window enforced in code)'),
  ('ai_program_adjust',1,  null, false, 'Manual AI program adjustments per week (encoded as 1/day; weekly window in code; auto-cron is premium)')
on conflict (feature) do update set
  free_daily_limit = excluded.free_daily_limit,
  free_total_limit = excluded.free_total_limit,
  premium_only = excluded.premium_only,
  description = excluded.description;
