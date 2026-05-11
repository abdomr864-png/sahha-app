-- Meal photos: owner-only read/write. Used by AI meal logging (vision).
-- TTL: 30 days, matching form-checks.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists meal_photos_owner_all on storage.objects;
create policy meal_photos_owner_all on storage.objects
  for all using (bucket_id = 'meal-photos' and owner = auth.uid())
  with check (bucket_id = 'meal-photos' and owner = auth.uid());

do $$ begin
  perform cron.schedule(
    'sahha-meal-photos-ttl',
    '0 3 * * *',
    $cmd$
      delete from storage.objects
      where bucket_id = 'meal-photos'
        and created_at < now() - interval '30 days';
    $cmd$
  );
exception when others then null; end $$;
