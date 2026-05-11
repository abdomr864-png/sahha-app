-- Personal records, body measurements, progress photos

create table if not exists personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  record_type pr_type not null,
  value numeric(10,2) not null,
  unit text not null default 'kg',
  reps smallint,
  achieved_at timestamptz not null default now(),
  workout_set_id uuid references workout_sets(id) on delete set null
);
create index if not exists pr_user_exercise_idx on personal_records (user_id, exercise_id, record_type, achieved_at desc);
alter table personal_records enable row level security;
drop policy if exists pr_self_all on personal_records;
create policy pr_self_all on personal_records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5,1),
  body_fat_pct numeric(4,1),
  chest_cm numeric(5,1),
  waist_cm numeric(5,1),
  arm_cm numeric(4,1),
  thigh_cm numeric(5,1),
  recorded_at timestamptz not null default now()
);
create index if not exists bm_user_recorded_idx on body_measurements (user_id, recorded_at desc);
alter table body_measurements enable row level security;
drop policy if exists bm_self_all on body_measurements;
create policy bm_self_all on body_measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text not null,
  pose text,
  recorded_at timestamptz not null default now(),
  is_private boolean not null default true
);
create index if not exists pp_user_recorded_idx on progress_photos (user_id, recorded_at desc);
alter table progress_photos enable row level security;
drop policy if exists pp_self_all on progress_photos;
create policy pp_self_all on progress_photos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
