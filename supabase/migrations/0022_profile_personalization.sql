-- Personalization fields used to compute daily targets (kcal, macros) on the
-- home screen. Added so onboarding can ask Cal-AI-style questions and produce
-- per-user calorie/macro goals instead of hardcoded constants.

do $$ begin
  create type activity_level as enum ('sedentary','light','moderate','very','extra');
exception when duplicate_object then null; end $$;

do $$ begin
  create type diet_preference as enum ('omnivore','vegetarian','vegan','keto','low_carb');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_pace as enum ('slow','standard','aggressive');
exception when duplicate_object then null; end $$;

alter table profiles
  add column if not exists activity_level activity_level,
  add column if not exists target_weight_kg numeric(5,1),
  add column if not exists diet_preference diet_preference,
  add column if not exists goal_pace goal_pace;
