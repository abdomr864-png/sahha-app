-- Storage buckets and policies

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('progress-photos', 'progress-photos', false),
  ('form-checks', 'form-checks', false)
on conflict (id) do nothing;

-- avatars: public read, owner-only write
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert with check (bucket_id = 'avatars' and owner = auth.uid());
drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update using (bucket_id = 'avatars' and owner = auth.uid());
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete using (bucket_id = 'avatars' and owner = auth.uid());

-- progress-photos: owner-only read/write
drop policy if exists pp_owner_all on storage.objects;
create policy pp_owner_all on storage.objects
  for all using (bucket_id = 'progress-photos' and owner = auth.uid())
  with check (bucket_id = 'progress-photos' and owner = auth.uid());

-- form-checks: owner-only read/write; pg_cron deletes after 30 days
drop policy if exists fc_owner_all on storage.objects;
create policy fc_owner_all on storage.objects
  for all using (bucket_id = 'form-checks' and owner = auth.uid())
  with check (bucket_id = 'form-checks' and owner = auth.uid());

-- TTL job: delete form-check objects older than 30 days
do $$ begin
  perform cron.schedule(
    'sahha-form-check-ttl',
    '0 3 * * *',
    $cmd$
      delete from storage.objects
      where bucket_id = 'form-checks'
        and created_at < now() - interval '30 days';
      delete from ai_form_checks
      where created_at < now() - interval '30 days';
    $cmd$
  );
exception when others then null; end $$;
