-- Exercise library, programs, workouts, sets

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_fr text not null,
  name_ar text not null,
  muscle_group text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  instructions_en text,
  instructions_fr text,
  instructions_ar text,
  video_url text,
  is_custom boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists exercises_muscle_idx on exercises (muscle_group);
create index if not exists exercises_equipment_idx on exercises (equipment);
create index if not exists exercises_custom_owner_idx on exercises (created_by) where is_custom = true;

alter table exercises enable row level security;

drop policy if exists exercises_read_global on exercises;
create policy exercises_read_global on exercises
  for select using (is_custom = false or created_by = auth.uid());

drop policy if exists exercises_insert_self on exercises;
create policy exercises_insert_self on exercises
  for insert with check (is_custom = true and created_by = auth.uid());

drop policy if exists exercises_update_self on exercises;
create policy exercises_update_self on exercises
  for update using (is_custom = true and created_by = auth.uid())
  with check (is_custom = true and created_by = auth.uid());

drop policy if exists exercises_delete_self on exercises;
create policy exercises_delete_self on exercises
  for delete using (is_custom = true and created_by = auth.uid());

-- programs and program structure
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal training_goal,
  weeks smallint not null default 4,
  days_per_week smallint not null default 3,
  is_template boolean not null default false,
  is_ai_generated boolean not null default false,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists programs_user_idx on programs (user_id);
alter table programs enable row level security;
drop policy if exists programs_self_all on programs;
create policy programs_self_all on programs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  week smallint not null,
  day_index smallint not null,
  name text
);
create index if not exists program_days_program_idx on program_days (program_id);
alter table program_days enable row level security;
drop policy if exists program_days_via_program on program_days;
create policy program_days_via_program on program_days
  for all using (
    exists (select 1 from programs p where p.id = program_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from programs p where p.id = program_id and p.user_id = auth.uid())
  );

create table if not exists program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references program_days(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  order_index smallint not null,
  target_sets smallint,
  target_reps smallint,
  target_rpe numeric(3,1),
  rest_seconds smallint,
  notes text
);
create index if not exists program_ex_day_idx on program_exercises (program_day_id);
alter table program_exercises enable row level security;
drop policy if exists program_ex_via_program on program_exercises;
create policy program_ex_via_program on program_exercises
  for all using (
    exists (
      select 1 from program_days d
      join programs p on p.id = d.program_id
      where d.id = program_day_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from program_days d
      join programs p on p.id = d.program_id
      where d.id = program_day_id and p.user_id = auth.uid()
    )
  );

-- workouts (logged sessions)
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_day_id uuid references program_days(id) on delete set null,
  name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_volume_kg numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_started_idx on workouts (user_id, started_at desc);
alter table workouts enable row level security;
drop policy if exists workouts_self_all on workouts;
create policy workouts_self_all on workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  order_index smallint not null
);
create index if not exists workout_ex_workout_idx on workout_exercises (workout_id);
alter table workout_exercises enable row level security;
drop policy if exists workout_ex_via_workout on workout_exercises;
create policy workout_ex_via_workout on workout_exercises
  for all using (
    exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  set_index smallint not null,
  reps smallint not null check (reps >= 0),
  weight_kg numeric(6,2) not null default 0 check (weight_kg >= 0),
  rpe numeric(3,1) check (rpe is null or (rpe >= 1 and rpe <= 10)),
  is_warmup boolean not null default false,
  is_drop_set boolean not null default false,
  completed_at timestamptz not null default now()
);
create index if not exists workout_sets_we_idx on workout_sets (workout_exercise_id);
alter table workout_sets enable row level security;
drop policy if exists workout_sets_via_workout on workout_sets;
create policy workout_sets_via_workout on workout_sets
  for all using (
    exists (
      select 1 from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  );
