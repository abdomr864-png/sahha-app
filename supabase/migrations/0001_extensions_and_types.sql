-- Sahha — extensions and shared enums
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- Goals
do $$ begin
  create type training_goal as enum ('hypertrophy','strength','recomp','general');
exception when duplicate_object then null; end $$;

do $$ begin
  create type experience_level as enum ('beginner','intermediate','advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type equipment_access as enum ('full_gym','home_gym','minimal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sex_kind as enum ('male','female','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type weight_unit as enum ('kg','lb');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pr_type as enum ('max_weight_at_reps','est_one_rm','max_set_volume');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_kind as enum ('workout','pr','photo','text');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_role as enum ('user','assistant','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('active','trialing','past_due','canceled','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sub_plan as enum ('free','premium_monthly','premium_yearly');
exception when duplicate_object then null; end $$;
