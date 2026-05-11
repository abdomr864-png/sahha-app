-- Admin role
-- An admin is any user whose auth.users.raw_app_meta_data->>'role' = 'admin'.
-- Set via Supabase Studio (Authentication → Users → ... → Edit user → app_metadata)
-- or via the service-role SDK:
--   supabase.auth.admin.updateUserById(id, { app_metadata: { role: 'admin' } })
--
-- The admin web app at /admin uses anon-key auth like any other client; the
-- elevated privileges are conferred by these RLS policies, not by carrying a
-- service-role key in the browser (which would be insecure).

create or replace function is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

grant execute on function is_admin() to anon, authenticated;

-- Fan out an "admin can do anything" FOR ALL policy across every user-scoped
-- table. We keep the existing self-scoped policies in place; admin policies
-- are additive (RLS is permissive by default — a row passes if ANY policy
-- allows it).
do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'exercises',
    'programs', 'program_days', 'program_exercises',
    'workouts', 'workout_exercises', 'workout_sets',
    'personal_records', 'body_measurements', 'progress_photos',
    'foods', 'meals', 'meal_items',
    'water_log', 'supplements', 'supplement_logs',
    'mood_log', 'sleep_log', 'wearable_metrics',
    'follows', 'posts', 'post_likes', 'post_comments', 'leaderboards_weekly',
    'ai_conversations', 'ai_messages', 'ai_form_checks', 'ai_program_adjustments',
    'subscriptions', 'usage_counters', 'entitlement_rules',
    'user_streaks', 'streak_events', 'exercise_progression_log', 'next_session_suggestions'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists admin_all on %I;', t);
    execute format(
      'create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin());',
      t
    );
  end loop;
end $$;

-- Admin-visible view over auth.users so the admin UI can show emails / signup
-- dates without needing the service-role key. The is_admin() gate is enforced
-- inside the view body — non-admin callers get an empty set.
create or replace view admin_users_view
with (security_invoker = false) as
select
  u.id,
  u.email,
  u.phone,
  u.created_at,
  u.last_sign_in_at,
  u.email_confirmed_at,
  u.banned_until,
  coalesce(u.raw_app_meta_data -> 'role', '"user"'::jsonb) #>> '{}' as role,
  u.raw_user_meta_data,
  p.username,
  p.display_name,
  p.locale,
  p.is_public
from auth.users u
left join profiles p on p.user_id = u.id
where is_admin();

grant select on admin_users_view to authenticated;

-- Aggregate counters for the dashboard. SECURITY DEFINER so they can peek at
-- auth.users without ownership; the is_admin() guard returns nulls otherwise.
create or replace function admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select jsonb_build_object(
    'users_total',           (select count(*) from auth.users),
    'users_new_24h',         (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'users_new_7d',          (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_24h',            (select count(distinct user_id) from workouts where coalesce(started_at, created_at) > now() - interval '24 hours'),
    'workouts_total',        (select count(*) from workouts),
    'workouts_7d',           (select count(*) from workouts where created_at > now() - interval '7 days'),
    'sets_total',            (select count(*) from workout_sets),
    'subs_active',           (select count(*) from subscriptions where status in ('active','trialing')),
    'subs_premium',          (select count(*) from subscriptions where plan in ('premium_monthly','premium_yearly') and status in ('active','trialing')),
    'ai_messages_24h',       (select count(*) from ai_messages where created_at > now() - interval '24 hours'),
    'form_checks_7d',        (select count(*) from ai_form_checks where created_at > now() - interval '7 days'),
    'posts_7d',              (select count(*) from posts where created_at > now() - interval '7 days'),
    'streaks_active',        (select count(*) from user_streaks where current_streak > 0)
  ) into result;

  return result;
end;
$$;

grant execute on function admin_dashboard_stats() to authenticated;

-- Convenience: per-day workout counts for the last 30 days (dashboard chart).
create or replace function admin_workouts_by_day(p_days int default 30)
returns table(day date, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    d::date as day,
    coalesce(count(w.id), 0) as count
  from generate_series(
    (current_date - (p_days - 1))::date,
    current_date,
    interval '1 day'
  ) d
  left join workouts w on w.created_at::date = d::date
  where is_admin()
  group by d::date
  order by d::date;
$$;

grant execute on function admin_workouts_by_day(int) to authenticated;
