-- One-time post-deploy setup for the smart-streak + auto-progression system.
--
-- Run this ONCE in the Supabase SQL editor after migrations 0023, 0024, and
-- 0027 have been applied. It populates `private_secrets` so that pg_net calls
-- from the workout-completion trigger and the hourly cron know where to fire.
--
-- HOW TO FILL THIS IN
--   1. Replace PROJECT_REF (two places) with your project reference.
--      Find at: Supabase Dashboard → Project Settings → General → Reference ID
--      Example: 'abcdefghijklmnop' → URL is https://abcdefghijklmnop.supabase.co
--   2. Replace SERVICE_ROLE_JWT (one place) with your service-role key.
--      Find at: Supabase Dashboard → Project Settings → API → Project API keys
--                → service_role (click "Reveal", copy the JWT).
--      Treat it like a root password — it bypasses RLS.
--
-- If 'service_role_jwt' was already set by a prior migration (e.g. the weekly
-- ai-adjust cron), the row is updated in place — no duplicate-key error.

insert into private_secrets (key, value) values
  ('resolve_streaks_url',     'https://PROJECT_REF.supabase.co/functions/v1/resolve-streaks'),
  ('compute_progression_url', 'https://PROJECT_REF.supabase.co/functions/v1/compute-progression'),
  ('service_role_jwt',        'SERVICE_ROLE_JWT')
on conflict (key) do update set value = excluded.value;

-- Sanity check — should return three rows; service_role_jwt is masked.
select key,
       case when key = 'service_role_jwt' then '••• (set, length=' || length(value) || ')'
            else value end as value
from private_secrets
where key in ('resolve_streaks_url', 'compute_progression_url', 'service_role_jwt');
