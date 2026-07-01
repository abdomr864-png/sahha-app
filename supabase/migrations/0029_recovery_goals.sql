-- ============================================================================
-- 0029_recovery_goals — personalized recovery / activity targets.
--
-- The home dashboard previously hard-coded the sleep (8h), steps (10k), and
-- active-minutes (30m) targets as constants in app/(tabs)/index.tsx. Nutrition
-- targets are personalized (computed from the profile by useDailyTargets), so
-- these activity/recovery targets now follow the same pattern: store optional
-- per-user goals on the profile and fall back to sensible defaults when unset.
--
-- All columns are nullable — a missing value means "use the app default", so no
-- backfill is required and existing rows keep working unchanged.
-- ============================================================================

alter table profiles
  -- Nightly sleep goal in minutes (default 480 = 8h when null).
  add column if not exists sleep_goal_min smallint
    check (sleep_goal_min is null or sleep_goal_min between 180 and 840),
  -- Daily step goal (default 10000 when null).
  add column if not exists steps_goal integer
    check (steps_goal is null or steps_goal between 1000 and 50000),
  -- Daily active-minutes goal (default 30 — WHO baseline — when null).
  add column if not exists active_minutes_goal smallint
    check (active_minutes_goal is null or active_minutes_goal between 5 and 240);
