-- Extend exercises with media + difficulty + alias matching for the equipment scanner.
-- Add injuries[] to profiles so AI generators can avoid contraindicated exercises.

alter table exercises add column if not exists photo_url text;
-- video_url already added in 0003_training.sql; ensured here for fresh DBs.
alter table exercises add column if not exists video_url text;
alter table exercises add column if not exists difficulty text default 'intermediate';
alter table exercises add column if not exists equipment_aliases text[] default '{}'::text[];

do $$ begin
  alter table exercises add constraint exercises_difficulty_check
    check (difficulty in ('beginner','intermediate','advanced'));
exception when duplicate_object then null; end $$;

create index if not exists exercises_aliases_gin on exercises using gin (equipment_aliases);
create index if not exists exercises_difficulty_idx on exercises (difficulty);

alter table profiles add column if not exists injuries text[] not null default '{}'::text[];
