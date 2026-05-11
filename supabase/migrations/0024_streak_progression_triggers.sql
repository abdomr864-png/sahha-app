-- Workout-completion dispatcher: one trigger fans out to streak handler (in-DB)
-- and progression edge function (pg_net).
--
-- Streak math runs in plpgsql for speed and ACID guarantees.
-- Progression math runs in an edge function (compute-progression) because it
-- pulls live RPE data and writes back to next_session_suggestions; doing it
-- in plpgsql would duplicate too much logic.
--
-- The trigger fires when a workout row transitions from ended_at IS NULL to
-- ended_at IS NOT NULL. Re-running 'finish' on an already-finished workout
-- (legal under offline retry semantics) does nothing.

-- ─────────────────────────────────────────────────────────────────────────────
-- handle_streak_workout_completed
-- ─────────────────────────────────────────────────────────────────────────────
-- Called once per workout-completion. Updates user_streaks + logs a streak_event.
-- Idempotent on retry: streak_events has a unique (user_id, event_date, event_type)
-- index, and current_streak only advances on the first 'completed' row of a
-- scheduled day.

create or replace function handle_streak_workout_completed(
  p_user_id uuid,
  p_workout_id uuid,
  p_workout_date date
) returns void
language plpgsql
security definer
as $$
declare
  v_streak user_streaks%rowtype;
  v_dow int;
  v_is_scheduled boolean;
  v_already_completed boolean;
  v_target int;
  v_milestone int;
begin
  -- Pull / lazily-create the streak row.
  select * into v_streak from user_streaks where user_id = p_user_id for update;
  if not found then
    -- Seed from profile: default scheduled days come from training_days_per_week.
    select coalesce(training_days_per_week, 3) into v_target
      from profiles where user_id = p_user_id;
    insert into user_streaks (user_id, scheduled_days, current_week_target)
    values (
      p_user_id,
      case coalesce(v_target, 3)
        when 1 then array[3]
        when 2 then array[2, 6]
        when 3 then array[1, 3, 5]
        when 4 then array[1, 2, 4, 5]
        when 5 then array[1, 2, 3, 5, 6]
        when 6 then array[1, 2, 3, 5, 6, 0]
        when 7 then array[0, 1, 2, 3, 4, 5, 6]
        else array[1, 3, 5]
      end,
      coalesce(v_target, 3)
    )
    returning * into v_streak;
  end if;

  v_dow := extract(dow from p_workout_date)::int;
  v_is_scheduled := v_streak.is_flexible_schedule
                    or v_dow = any (v_streak.scheduled_days);

  -- Already counted today?
  select exists (
    select 1 from streak_events
    where user_id = p_user_id
      and event_date = p_workout_date
      and event_type in ('completed', 'bonus_completed')
  ) into v_already_completed;

  -- Always log totals + last_workout_date.
  update user_streaks
  set total_workouts_logged = total_workouts_logged + 1,
      last_workout_date = greatest(coalesce(last_workout_date, p_workout_date), p_workout_date)
  where user_id = p_user_id;

  if v_already_completed then
    return; -- second workout same day is fine but doesn't advance the streak.
  end if;

  if v_is_scheduled then
    -- Counts toward streak + weekly target.
    insert into streak_events (user_id, event_date, event_type, workout_id)
    values (p_user_id, p_workout_date, 'completed', p_workout_id)
    on conflict (user_id, event_date, event_type) do nothing;

    update user_streaks
    set current_streak = current_streak + 1,
        longest_streak = greatest(longest_streak, current_streak + 1),
        current_week_completions = current_week_completions + 1
    where user_id = p_user_id
    returning * into v_streak;

    -- Milestone log (UI surfaces this via notifications).
    foreach v_milestone in array array[7, 14, 30, 50, 100, 365] loop
      if v_streak.current_streak = v_milestone then
        insert into streak_events (user_id, event_date, event_type, workout_id, notes)
        values (p_user_id, p_workout_date, 'milestone', p_workout_id, v_milestone::text)
        on conflict (user_id, event_date, event_type) do nothing;
      end if;
    end loop;
  else
    -- Bonus workout on a rest day: log it, but don't bump streak.
    insert into streak_events (user_id, event_date, event_type, workout_id)
    values (p_user_id, p_workout_date, 'bonus_completed', p_workout_id)
    on conflict (user_id, event_date, event_type) do nothing;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Dispatcher trigger on workouts
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_workout_completed_dispatch() returns trigger
language plpgsql
security definer
as $$
declare
  v_url text;
  v_jwt text;
  v_workout_date date;
begin
  -- Only fire on the ended_at transition from NULL -> NOT NULL.
  if new.ended_at is null then return new; end if;
  if old.ended_at is not null then return new; end if;

  v_workout_date := (coalesce(new.ended_at, new.started_at))::date;

  -- 1) Streak update (synchronous, always runs).
  perform handle_streak_workout_completed(new.user_id, new.id, v_workout_date);

  -- 2) Progression compute (async via pg_net to compute-progression edge fn).
  --    Skipped silently if secrets are absent — the app still works, just no
  --    auto-suggestions until the secrets are filled in (same pattern as D34).
  begin
    select value into v_url
      from private_secrets where key = 'compute_progression_url';
    select value into v_jwt
      from private_secrets where key = 'service_role_jwt';
    if v_url is not null and v_jwt is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'authorization', 'Bearer ' || v_jwt,
          'content-type', 'application/json'
        ),
        body := jsonb_build_object(
          'workout_id', new.id,
          'user_id', new.user_id
        )
      );
    end if;
  exception when others then
    -- Never block a workout finish on pg_net / extension issues.
    raise notice 'compute-progression dispatch failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists workouts_completed_dispatch on workouts;
create trigger workouts_completed_dispatch
  after update of ended_at on workouts
  for each row execute function trg_workout_completed_dispatch();

-- ─────────────────────────────────────────────────────────────────────────────
-- Sync hook: keep user_streaks.current_week_target in step with profiles.
-- ─────────────────────────────────────────────────────────────────────────────
-- Denormalized on purpose: the weekly cron snapshots the target at week start
-- so changing intent mid-week doesn't retroactively mark a recovery week.
-- We only sync forward when there is no in-progress streak state.

create or replace function trg_sync_streak_target_from_profile() returns trigger
language plpgsql
security definer
as $$
begin
  if new.training_days_per_week is not null
     and new.training_days_per_week is distinct from old.training_days_per_week then
    update user_streaks
    set current_week_target = new.training_days_per_week
    where user_id = new.user_id
      and current_week_completions = 0;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_streak_target on profiles;
create trigger profiles_sync_streak_target
  after update of training_days_per_week on profiles
  for each row execute function trg_sync_streak_target_from_profile();
