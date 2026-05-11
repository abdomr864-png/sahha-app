-- profiles: 1:1 with auth.users
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  avatar_url text,
  locale text not null default 'en' check (locale in ('en','fr','ar')),
  weight_unit weight_unit not null default 'kg',
  dob date,
  sex sex_kind,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  goal training_goal,
  experience_level experience_level,
  training_days_per_week smallint check (training_days_per_week between 1 and 7),
  equipment_access equipment_access,
  bio text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on profiles (username);

alter table profiles enable row level security;

drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles
  for select using (user_id = auth.uid());

drop policy if exists profiles_public_read on profiles;
create policy profiles_public_read on profiles
  for select using (is_public = true);

drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles
  for insert with check (user_id = auth.uid());

drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists profiles_self_delete on profiles;
create policy profiles_self_delete on profiles
  for delete using (user_id = auth.uid());

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
