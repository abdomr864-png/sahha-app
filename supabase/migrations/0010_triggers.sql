-- Triggers: PR detection, total_volume_kg recompute

-- Recompute workout total volume on set changes
create or replace function recompute_workout_volume(p_workout_id uuid) returns void as $$
begin
  update workouts w set total_volume_kg = coalesce((
    select sum(s.reps * s.weight_kg)
    from workout_sets s
    join workout_exercises we on we.id = s.workout_exercise_id
    where we.workout_id = p_workout_id and s.is_warmup = false
  ), 0)
  where w.id = p_workout_id;
end;
$$ language plpgsql security definer;

create or replace function trg_set_recompute_volume() returns trigger as $$
declare
  v_workout uuid;
begin
  if tg_op = 'DELETE' then
    select we.workout_id into v_workout from workout_exercises we where we.id = old.workout_exercise_id;
  else
    select we.workout_id into v_workout from workout_exercises we where we.id = new.workout_exercise_id;
  end if;
  if v_workout is not null then
    perform recompute_workout_volume(v_workout);
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists workout_sets_recompute on workout_sets;
create trigger workout_sets_recompute
  after insert or update or delete on workout_sets
  for each row execute function trg_set_recompute_volume();

-- PR detection: max_weight_at_reps, est_one_rm (Epley), max_set_volume
create or replace function trg_detect_prs() returns trigger as $$
declare
  v_user uuid;
  v_exercise uuid;
  v_one_rm numeric(10,2);
  v_volume numeric(10,2);
  v_prev_max_weight numeric(10,2);
  v_prev_one_rm numeric(10,2);
  v_prev_volume numeric(10,2);
begin
  if new.is_warmup or new.reps = 0 or new.weight_kg = 0 then
    return new;
  end if;

  select w.user_id, we.exercise_id into v_user, v_exercise
  from workout_exercises we
  join workouts w on w.id = we.workout_id
  where we.id = new.workout_exercise_id;

  if v_user is null then return new; end if;

  -- Epley: 1RM = weight * (1 + reps/30)
  v_one_rm := round(new.weight_kg * (1 + new.reps::numeric / 30), 2);
  v_volume := round(new.reps * new.weight_kg, 2);

  -- max weight at this rep count
  select coalesce(max(value), 0) into v_prev_max_weight
  from personal_records
  where user_id = v_user and exercise_id = v_exercise
    and record_type = 'max_weight_at_reps' and reps = new.reps;
  if new.weight_kg > v_prev_max_weight then
    insert into personal_records (user_id, exercise_id, record_type, value, unit, reps, achieved_at, workout_set_id)
    values (v_user, v_exercise, 'max_weight_at_reps', new.weight_kg, 'kg', new.reps, new.completed_at, new.id);
  end if;

  -- estimated 1RM
  select coalesce(max(value), 0) into v_prev_one_rm
  from personal_records
  where user_id = v_user and exercise_id = v_exercise and record_type = 'est_one_rm';
  if v_one_rm > v_prev_one_rm then
    insert into personal_records (user_id, exercise_id, record_type, value, unit, reps, achieved_at, workout_set_id)
    values (v_user, v_exercise, 'est_one_rm', v_one_rm, 'kg', new.reps, new.completed_at, new.id);
  end if;

  -- max set volume
  select coalesce(max(value), 0) into v_prev_volume
  from personal_records
  where user_id = v_user and exercise_id = v_exercise and record_type = 'max_set_volume';
  if v_volume > v_prev_volume then
    insert into personal_records (user_id, exercise_id, record_type, value, unit, reps, achieved_at, workout_set_id)
    values (v_user, v_exercise, 'max_set_volume', v_volume, 'kg', new.reps, new.completed_at, new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists workout_sets_detect_prs on workout_sets;
create trigger workout_sets_detect_prs
  after insert on workout_sets
  for each row execute function trg_detect_prs();
