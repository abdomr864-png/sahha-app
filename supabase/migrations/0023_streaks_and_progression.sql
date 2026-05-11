-- Smart Streaks + Auto-Progressing Difficulty
--
-- Five tables and one column extension:
--   * user_streaks                  — one row per user, canonical state
--   * streak_events                 — per-day audit log; drives heatmap UI
--   * exercise_progression_log      — audit log of progression decisions
--   * next_session_suggestions      — pending in-session suggestions (weight/reps/sets)
--   * program_exercises.progression_model — per-program-exercise progression state
--
-- A workout-completion dispatcher is added in 0024_streak_progression_triggers.sql
-- so this file is pure schema and idempotent on re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. user_streaks
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  total_workouts_logged int not null default 0,
  last_workout_date date,
  -- scheduled_days: 0=Sun .. 6=Sat (matches JS Date.getDay()).
  scheduled_days int[] not null default array[1,3,5],
  is_flexible_schedule boolean not null default false,
  freezes_used_this_week int not null default 0,
  freezes_available int not null default 1,
  week_start_date date not null default date_trunc('week', current_date)::date,
  current_week_completions int not null default 0,
  current_week_target int not null default 3,
  is_recovery_week boolean not null default false,
  -- Stored as IANA tz string; resolve-streaks edge fn uses this to bucket end-of-day.
  -- Null => treat as UTC.
  timezone text,
  -- Bookkeeping for the hourly resolver: last date we ran end-of-day for.
  last_resolved_date date,
  updated_at timestamptz not null default now()
);

alter table user_streaks enable row level security;

drop policy if exists user_streaks_self_all on user_streaks;
create policy user_streaks_self_all on user_streaks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists user_streaks_last_resolved_idx
  on user_streaks (last_resolved_date);

-- updated_at trigger reuses the function declared in 0002_profiles.sql.
drop trigger if exists user_streaks_set_updated_at on user_streaks;
create trigger user_streaks_set_updated_at before update on user_streaks
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. streak_events
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists streak_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  event_type text not null check (event_type in (
    'completed',
    'bonus_completed',
    'freeze_used',
    'missed',
    'rest_day',
    'recovery_week',
    'week_completed',
    'reset',
    'milestone'
  )),
  workout_id uuid references workouts(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table streak_events enable row level security;

drop policy if exists streak_events_self_all on streak_events;
create policy streak_events_self_all on streak_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists streak_events_user_date_idx
  on streak_events (user_id, event_date desc);

-- One row per (user, date, event_type) — used so the resolver can upsert
-- 'missed' / 'rest_day' / 'freeze_used' once per scheduled day without dupes.
create unique index if not exists streak_events_uniq_per_day
  on streak_events (user_id, event_date, event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. program_exercises.progression_model
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Shape (validated on the edge-fn side):
--   {
--     "type": "linear",
--     "target_reps_min": 8,
--     "target_reps_max": 12,
--     "target_sets": 3,
--     "current_reps": 8,
--     "current_sets": 3,
--     "weeks_at_current": 0
--   }
alter table program_exercises
  add column if not exists progression_model jsonb;

-- Backfill any existing rows with sensible defaults derived from current
-- target_sets / target_reps. Existing rows without targets get 3x8–12.
update program_exercises
set progression_model = jsonb_build_object(
  'type', 'linear',
  'target_reps_min', coalesce(target_reps::int, 8),
  'target_reps_max', coalesce(target_reps::int, 8) + 4,
  'target_sets', coalesce(target_sets::int, 3),
  'current_reps', coalesce(target_reps::int, 8),
  'current_sets', coalesce(target_sets::int, 3),
  'weeks_at_current', 0
)
where progression_model is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. exercise_progression_log
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists exercise_progression_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  program_exercise_id uuid references program_exercises(id) on delete set null,
  event_type text not null check (event_type in (
    'reps_increased',
    'sets_increased',
    'weight_suggested',
    'weight_accepted',
    'weight_declined',
    'deload_suggested',
    'pr_prompt',
    'held'
  )),
  from_value jsonb,
  to_value jsonb,
  rpe_evidence jsonb,
  decided_at timestamptz not null default now()
);

alter table exercise_progression_log enable row level security;

drop policy if exists exercise_progression_log_self_all on exercise_progression_log;
create policy exercise_progression_log_self_all on exercise_progression_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists exercise_progression_log_user_idx
  on exercise_progression_log (user_id, decided_at desc);

create index if not exists exercise_progression_log_exercise_idx
  on exercise_progression_log (user_id, exercise_id, decided_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. next_session_suggestions
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists next_session_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  program_exercise_id uuid references program_exercises(id) on delete set null,
  suggested_weight_kg numeric(6,2),
  suggested_reps int,
  suggested_sets int,
  reasoning text,
  is_pr_attempt boolean not null default false,
  rpe_evidence jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  consumed_at timestamptz,
  consumed_decision text check (consumed_decision in ('accepted','declined'))
);

alter table next_session_suggestions enable row level security;

drop policy if exists next_session_suggestions_self_all on next_session_suggestions;
create policy next_session_suggestions_self_all on next_session_suggestions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Latest unconsumed suggestion per (user, exercise) — the in-session card query.
create index if not exists next_session_suggestions_lookup_idx
  on next_session_suggestions (user_id, exercise_id, consumed_at, expires_at desc);
