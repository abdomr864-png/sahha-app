-- ============================================================================
-- 0032_readiness_snapshots — daily readiness verdict (Feature 1, the flagship).
--
-- The readiness engine consumes the EXISTING recovery system (daily recovery
-- score + ACWR from features/health/recovery) and yesterday's training load to
-- produce one verdict ∈ {primed, ready, caution, rest} plus a concrete training
-- adjustment (load multiplier + RPE cap). It does NOT recompute recovery.
--
-- One row per user per local day (upsert on user_id, date). `inputs` keeps the
-- raw signals that drove the verdict so the "why" expander and later analytics
-- can reconstruct the decision without re-querying every source.
--
-- The verdict + adjustment are Pro (the basic recovery score stays free), gated
-- via the existing entitlement_rules table (0009) — a premium_only row added
-- below.
--
-- Idempotent. Rollback:
--   drop table if exists readiness_snapshots;
--   delete from entitlement_rules where feature = 'readiness';
-- ============================================================================

create table if not exists readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Local-timezone calendar day (training is logged in local time, not UTC).
  date date not null,
  -- Snapshot of the recovery system's output that drove this verdict.
  recovery_score smallint check (recovery_score is null or recovery_score between 0 and 100),
  acwr numeric(5, 2),
  training_load numeric(12, 2),
  state text not null check (state in ('primed', 'ready', 'caution', 'rest')),
  -- Suggested adjustment applied to the planned session.
  load_multiplier numeric(4, 2) not null check (load_multiplier >= 0 and load_multiplier <= 2),
  rpe_cap numeric(3, 1) check (rpe_cap is null or rpe_cap between 1 and 10),
  -- Raw drivers (recovery band, days since rest, subjective check-in, …).
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists readiness_snapshots_user_date_idx
  on readiness_snapshots (user_id, date desc);

alter table readiness_snapshots enable row level security;

-- Standard owner-only CRUD (user_id = auth.uid()) for all four verbs.
drop policy if exists readiness_self_select on readiness_snapshots;
create policy readiness_self_select on readiness_snapshots
  for select using (user_id = auth.uid());

drop policy if exists readiness_self_insert on readiness_snapshots;
create policy readiness_self_insert on readiness_snapshots
  for insert with check (user_id = auth.uid());

drop policy if exists readiness_self_update on readiness_snapshots;
create policy readiness_self_update on readiness_snapshots
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists readiness_self_delete on readiness_snapshots;
create policy readiness_self_delete on readiness_snapshots
  for delete using (user_id = auth.uid());

-- Gate the verdict behind Pro. Basic recovery score stays free (Recovery page);
-- the readiness verdict + load adjustment require Premium.
insert into entitlement_rules (feature, free_daily_limit, free_total_limit, premium_only, description) values
  ('readiness', null, null, true, 'Daily readiness verdict + load adjustment')
on conflict (feature) do nothing;
