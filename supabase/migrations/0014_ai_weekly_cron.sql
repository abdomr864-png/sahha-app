-- Weekly auto-review cron for premium users (best-effort).
--
-- This schedules a Monday-06:00-UTC job that invokes the ai-adjust-program
-- edge function for every premium user with at least one program. We use
-- pg_net since pg_cron can't call HTTP directly. The function URL and the
-- service-role key are read from a tiny secrets table so this migration
-- doesn't have to know the project URL at apply time.
--
-- Usage after first deploy:
--   insert into private_secrets (key, value) values
--     ('ai_adjust_url', 'https://<project>.supabase.co/functions/v1/ai-adjust-program'),
--     ('service_role_jwt', '<service role JWT>');

create table if not exists private_secrets (
  key text primary key,
  value text not null
);
revoke all on private_secrets from anon, authenticated;
alter table private_secrets enable row level security;
-- no policies => only service role can read/write.

create or replace function enqueue_weekly_adjustments() returns void
language plpgsql
security definer
as $$
declare
  rec record;
  url text;
  jwt text;
begin
  select value into url from private_secrets where key = 'ai_adjust_url';
  select value into jwt from private_secrets where key = 'service_role_jwt';
  if url is null or jwt is null then
    raise notice 'ai weekly cron skipped: missing secrets';
    return;
  end if;

  for rec in
    select distinct p.user_id, p.id as program_id
    from programs p
    join subscriptions s on s.user_id = p.user_id
    where s.status in ('active', 'trialing')
  loop
    perform net.http_post(
      url := url,
      headers := jsonb_build_object(
        'authorization', 'Bearer ' || jwt,
        'content-type', 'application/json'
      ),
      body := jsonb_build_object('program_id', rec.program_id)
    );
  end loop;
end;
$$;

do $$ begin
  perform cron.schedule(
    'sahha-weekly-program-adjust',
    '0 6 * * 1',  -- Monday 06:00 UTC
    $cmd$ select enqueue_weekly_adjustments(); $cmd$
  );
exception when others then null; end $$;
