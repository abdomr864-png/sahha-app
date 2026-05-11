-- Health-data sync: extend wearable_metrics, add sleep_sessions_synced and
-- workouts_synced. All tables RLS-protected per user_id.

-- 1. Allow Health Connect as a source on wearable_metrics.
alter table wearable_metrics
  drop constraint if exists wearable_metrics_source_check;
alter table wearable_metrics
  add constraint wearable_metrics_source_check
  check (source in ('apple_health','google_fit','health_connect','manual','mock'));

-- 2. Extend wearable_metrics with sync metadata.
alter table wearable_metrics add column if not exists source_uuid text;
alter table wearable_metrics add column if not exists device_name text;
alter table wearable_metrics add column if not exists recorded_at_local timestamptz;
alter table wearable_metrics add column if not exists synced_at timestamptz default now();
alter table wearable_metrics add column if not exists metadata jsonb;

-- Idempotent upserts: same sample re-synced never duplicates.
create unique index if not exists uniq_wearable_sample
  on wearable_metrics (user_id, source, metric_type, recorded_at, source_uuid);

create index if not exists idx_wearable_user_type_time
  on wearable_metrics (user_id, metric_type, recorded_at desc);

-- 3. sleep_sessions_synced — distinct from manual `sleep_log`.
create table if not exists sleep_sessions_synced (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('apple_health','health_connect','mock')),
  source_uuid text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes int not null,
  in_bed_minutes int,
  asleep_minutes int,
  awake_minutes int,
  rem_minutes int,
  deep_minutes int,
  light_minutes int,
  device_name text,
  metadata jsonb,
  synced_at timestamptz not null default now()
);
alter table sleep_sessions_synced enable row level security;
drop policy if exists sleep_synced_self_all on sleep_sessions_synced;
create policy sleep_synced_self_all on sleep_sessions_synced
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create unique index if not exists uniq_sleep_session
  on sleep_sessions_synced (user_id, source, started_at, source_uuid);
create index if not exists idx_sleep_synced_user_started
  on sleep_sessions_synced (user_id, started_at desc);

-- 4. workouts_synced — distinct from precise in-app `workouts`.
create table if not exists workouts_synced (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('apple_health','health_connect','mock')),
  source_uuid text,
  workout_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes int not null,
  total_calories numeric,
  active_calories numeric,
  distance_meters numeric,
  avg_heart_rate int,
  max_heart_rate int,
  device_name text,
  metadata jsonb,
  linked_workout_id uuid references workouts(id) on delete set null,
  is_imported_to_app boolean not null default false,
  synced_at timestamptz not null default now()
);
alter table workouts_synced enable row level security;
drop policy if exists workouts_synced_self_all on workouts_synced;
create policy workouts_synced_self_all on workouts_synced
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create unique index if not exists uniq_synced_workout
  on workouts_synced (user_id, source, started_at, source_uuid);
create index if not exists idx_workouts_synced_user_started
  on workouts_synced (user_id, started_at desc);

-- 5. Per-user health-sync settings: which categories are enabled, last sync,
--    and whether AI prompts may consume biometric data.
create table if not exists health_sync_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled_types text[] not null default array[
    'steps','heart_rate','resting_heart_rate','hrv',
    'active_calories','total_calories','sleep','workouts','weight','body_fat'
  ],
  ai_biometrics_optin boolean not null default false,
  last_synced_at timestamptz,
  permission_revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table health_sync_settings enable row level security;
drop policy if exists hss_self_all on health_sync_settings;
create policy hss_self_all on health_sync_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
