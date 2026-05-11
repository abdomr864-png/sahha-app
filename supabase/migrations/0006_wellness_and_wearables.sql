-- Mood, sleep, wearable metrics

create table if not exists mood_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  note text,
  logged_at timestamptz not null default now()
);
create index if not exists mood_user_logged_idx on mood_log (user_id, logged_at desc);
alter table mood_log enable row level security;
drop policy if exists mood_self_all on mood_log;
create policy mood_self_all on mood_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists sleep_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  quality_score smallint check (quality_score between 1 and 5)
);
create index if not exists sleep_user_started_idx on sleep_log (user_id, started_at desc);
alter table sleep_log enable row level security;
drop policy if exists sleep_self_all on sleep_log;
create policy sleep_self_all on sleep_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists wearable_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('apple_health','google_fit','manual')),
  metric_type text not null,
  value numeric(12,3) not null,
  unit text not null,
  recorded_at timestamptz not null
);
create index if not exists wm_user_recorded_idx on wearable_metrics (user_id, metric_type, recorded_at desc);
alter table wearable_metrics enable row level security;
drop policy if exists wm_self_all on wearable_metrics;
create policy wm_self_all on wearable_metrics
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
