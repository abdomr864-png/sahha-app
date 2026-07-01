-- Strength levels + badges
--
-- Two tables, both per-user and read/write isolated by RLS:
--   * user_strength_estimates — one row per (user, canonical lift): the best
--     estimated 1RM over the recent window, the classified level, and the
--     bodyweight ratio it was derived from. Recomputed client-side after a
--     workout is logged (see features/strength/services/recompute.ts).
--   * user_badges            — append-only award log. A badge is granted once
--     and never re-granted; idempotency is enforced by the (user_id, badge_id)
--     primary key + `on conflict do nothing` upserts.
--
-- Estimates are derived data: they are a deterministic function of the user's
-- own workout_sets + profile, so recompute is always safe to re-run. Levels and
-- ratios are nullable because a user can log lifts before setting bodyweight/sex,
-- in which case we still persist the e1RM but cannot classify it yet.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. user_strength_estimates
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists user_strength_estimates (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Canonical lift key from features/strength/config/lifts.ts
  -- ('squat' | 'bench' | 'deadlift' | 'overhead_press' | 'barbell_row').
  lift_id text not null,
  -- The concrete exercise the estimate was derived from (best variant).
  exercise_id uuid references exercises(id) on delete set null,
  est_one_rm_kg numeric(7,2) not null check (est_one_rm_kg >= 0),
  -- The raw best set behind the estimate, kept for display / auditing.
  best_weight_kg numeric(7,2) not null default 0 check (best_weight_kg >= 0),
  best_reps smallint not null default 0 check (best_reps >= 0),
  -- Classification result. Null when bodyweight/sex are unknown.
  level text check (
    level is null or level in ('beginner', 'novice', 'intermediate', 'advanced', 'elite')
  ),
  -- e1RM / bodyweight at computation time (null when bodyweight unknown).
  bodyweight_ratio numeric(5,2),
  bodyweight_kg numeric(5,1),
  computed_at timestamptz not null default now(),
  primary key (user_id, lift_id)
);

create index if not exists user_strength_estimates_user_idx
  on user_strength_estimates (user_id);

alter table user_strength_estimates enable row level security;

drop policy if exists user_strength_estimates_self_all on user_strength_estimates;
create policy user_strength_estimates_self_all on user_strength_estimates
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_badges
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Stable badge identifier from features/strength/config/badges.ts
  -- e.g. 'level_bench_intermediate', 'plate_2', 'bodyweight_bench'.
  badge_id text not null,
  earned_at timestamptz not null default now(),
  -- Optional snapshot of the value that unlocked the badge (e.g. the e1RM),
  -- so the gallery can show "Bench 102.5kg" without recomputing.
  meta jsonb,
  primary key (user_id, badge_id)
);

create index if not exists user_badges_user_idx on user_badges (user_id);

alter table user_badges enable row level security;

drop policy if exists user_badges_self_all on user_badges;
create policy user_badges_self_all on user_badges
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
