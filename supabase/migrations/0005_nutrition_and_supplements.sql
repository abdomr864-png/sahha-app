-- Foods, meals, water, supplements

create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  calories numeric(7,2) not null default 0,
  protein_g numeric(6,2) not null default 0,
  carbs_g numeric(6,2) not null default 0,
  fat_g numeric(6,2) not null default 0,
  serving_size_g numeric(7,2) not null default 100,
  source text,
  barcode text unique
);
create index if not exists foods_barcode_idx on foods (barcode);
alter table foods enable row level security;
drop policy if exists foods_read_all on foods;
create policy foods_read_all on foods for select using (true);
-- writes restricted to service role; no policy granted to authenticated.

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  meal_type text check (meal_type in ('breakfast','lunch','dinner','snack')),
  eaten_at timestamptz not null default now()
);
create index if not exists meals_user_eaten_idx on meals (user_id, eaten_at desc);
alter table meals enable row level security;
drop policy if exists meals_self_all on meals;
create policy meals_self_all on meals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  food_id uuid references foods(id) on delete set null,
  custom_name text,
  calories numeric(7,2) not null default 0,
  protein_g numeric(6,2) not null default 0,
  carbs_g numeric(6,2) not null default 0,
  fat_g numeric(6,2) not null default 0,
  quantity_g numeric(7,2) not null default 100
);
alter table meal_items enable row level security;
drop policy if exists meal_items_via_meal on meal_items;
create policy meal_items_via_meal on meal_items
  for all using (
    exists (select 1 from meals m where m.id = meal_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from meals m where m.id = meal_id and m.user_id = auth.uid())
  );

create table if not exists water_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml smallint not null check (amount_ml > 0),
  logged_at timestamptz not null default now()
);
create index if not exists water_user_logged_idx on water_log (user_id, logged_at desc);
alter table water_log enable row level security;
drop policy if exists water_self_all on water_log;
create policy water_self_all on water_log
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,
  frequency text,
  times jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists supplements_user_idx on supplements (user_id);
alter table supplements enable row level security;
drop policy if exists supp_self_all on supplements;
create policy supp_self_all on supplements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplement_id uuid not null references supplements(id) on delete cascade,
  taken_at timestamptz not null default now(),
  skipped boolean not null default false
);
create index if not exists supp_logs_user_idx on supplement_logs (user_id, taken_at desc);
alter table supplement_logs enable row level security;
drop policy if exists supp_logs_self_all on supplement_logs;
create policy supp_logs_self_all on supplement_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
