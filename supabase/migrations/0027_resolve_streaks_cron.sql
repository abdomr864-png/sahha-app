-- Hourly cron that invokes the resolve-streaks edge function.
--
-- One job covers every timezone — the edge function decides per-user whether
-- midnight has crossed in their local tz and short-circuits otherwise.
--
-- Project setup (run once after first deploy, same pattern as D34):
--   insert into private_secrets (key, value) values
--     ('resolve_streaks_url',
--      'https://<project>.supabase.co/functions/v1/resolve-streaks'),
--     ('service_role_jwt', '<service role JWT>');
-- (compute_progression_url is set by 0024; reuse service_role_jwt.)

create or replace function enqueue_resolve_streaks() returns void
language plpgsql
security definer
as $$
declare
  v_url text;
  v_jwt text;
begin
  select value into v_url from private_secrets where key = 'resolve_streaks_url';
  select value into v_jwt from private_secrets where key = 'service_role_jwt';
  if v_url is null or v_jwt is null then
    raise notice 'resolve-streaks skipped: missing secrets';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || v_jwt,
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('now', now())
  );
end;
$$;

do $$ begin
  -- Top of every hour.
  perform cron.schedule(
    'sahha-resolve-streaks',
    '0 * * * *',
    $cmd$ select enqueue_resolve_streaks(); $cmd$
  );
exception when others then null; end $$;
