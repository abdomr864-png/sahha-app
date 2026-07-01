-- ============================================================================
-- 0028_health_metrics — canonical, normalized health-data store.
--
-- Supersedes the wearable_metrics / sleep_sessions_synced / workouts_synced
-- trio (migrations 0006/0021). Those tables are LEFT IN PLACE for now (no data
-- loss) but are no longer written or read by the app; drop them in a later
-- migration once the new layer is verified in production.
--
-- One row per sample. Incremental sync state (HK anchor / HC changes token, or
-- a time cursor) lives in health_sync_state. A daily-aggregate view powers the
-- dashboard so screens read Supabase, never the device.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- health_metrics — one row per sample
-- ---------------------------------------------------------------------------
create table if not exists health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- steps | distance | active_minutes | workout | sleep | resting_hr |
  -- hrv_sdnn | hrv_rmssd | weight
  -- NOTE: HRV is split by source measurement — Apple HealthKit reports SDNN,
  -- Android Health Connect reports RMSSD. They are DIFFERENT measurements and
  -- must not be averaged together; the variant is encoded in metric_type.
  metric_type text not null,
  value numeric not null,
  unit text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  source text,                        -- e.g. "Apple Watch", "Mi Band"
  source_platform text not null check (source_platform in ('ios', 'android')),
  external_id text,                   -- stable id from HK/HC for dedup
  metadata jsonb,
  created_at timestamptz not null default now(),
  -- Dedup key: the same sample re-synced (even from multiple queries) upserts
  -- in place instead of duplicating.
  unique (user_id, metric_type, external_id)
);

alter table health_metrics enable row level security;
drop policy if exists health_metrics_self_all on health_metrics;
create policy health_metrics_self_all on health_metrics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Fast "latest N samples of a type for this user" — drives dashboards + view.
create index if not exists idx_health_metrics_user_type_start
  on health_metrics (user_id, metric_type, start_time desc);

-- ---------------------------------------------------------------------------
-- health_sync_state — per-user, per-platform, per-metric sync cursor
-- ---------------------------------------------------------------------------
create table if not exists health_sync_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  metric_type text not null,
  -- HK HKAnchoredObjectQuery anchor / HC getChanges token when available;
  -- otherwise unused (the app falls back to a last_synced_at time cursor).
  sync_token text,
  last_synced_at timestamptz,
  primary key (user_id, platform, metric_type)
);

alter table health_sync_state enable row level security;
drop policy if exists health_sync_state_self_all on health_sync_state;
create policy health_sync_state_self_all on health_sync_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- health_daily — per-day aggregate per metric, for fast dashboard reads.
--   sum     → steps, distance, active_minutes, sleep
--   count   → workout (number of sessions/day)
--   latest  → weight (most recent reading that day)
--   avg     → resting_hr, hrv_sdnn, hrv_rmssd
-- The day bucket uses start_time in UTC; clients render in local time.
-- ---------------------------------------------------------------------------
create or replace view health_daily
with (security_invoker = true) as
select
  user_id,
  metric_type,
  (date_trunc('day', start_time))::date as day,
  case
    when metric_type in ('steps', 'distance', 'active_minutes', 'sleep')
      then sum(value)
    when metric_type = 'workout'
      then count(*)::numeric
    when metric_type = 'weight'
      then (array_agg(value order by start_time desc))[1]
    else avg(value)            -- resting_hr, hrv_sdnn, hrv_rmssd
  end as value,
  max(unit) as unit,
  count(*)::int as sample_count,
  min(start_time) as first_sample_at,
  max(start_time) as last_sample_at
from health_metrics
group by user_id, metric_type, (date_trunc('day', start_time))::date;
