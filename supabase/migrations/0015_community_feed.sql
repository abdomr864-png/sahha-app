-- Community feed MVP: media on posts, saved-posts table, public read, media bucket.

alter table posts add column if not exists image_url text;
alter table posts add column if not exists updated_at timestamptz not null default now();

drop trigger if exists posts_set_updated_at on posts;
create trigger posts_set_updated_at before update on posts
  for each row execute function set_updated_at();

-- Public feed: any authenticated user can read posts (Instagram-style global feed).
drop policy if exists posts_read_public_feed on posts;
create policy posts_read_public_feed on posts
  for select using (auth.uid() is not null);

create table if not exists post_saves (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_saves_user_idx on post_saves (user_id, created_at desc);
alter table post_saves enable row level security;

drop policy if exists post_saves_self_read on post_saves;
create policy post_saves_self_read on post_saves
  for select using (user_id = auth.uid());
drop policy if exists post_saves_self_insert on post_saves;
create policy post_saves_self_insert on post_saves
  for insert with check (user_id = auth.uid());
drop policy if exists post_saves_self_delete on post_saves;
create policy post_saves_self_delete on post_saves
  for delete using (user_id = auth.uid());

-- Storage bucket for community media (post images).
insert into storage.buckets (id, name, public)
values ('community-media', 'community-media', true)
on conflict (id) do nothing;

drop policy if exists community_media_public_read on storage.objects;
create policy community_media_public_read on storage.objects
  for select using (bucket_id = 'community-media');
drop policy if exists community_media_owner_write on storage.objects;
create policy community_media_owner_write on storage.objects
  for insert with check (bucket_id = 'community-media' and owner = auth.uid());
drop policy if exists community_media_owner_update on storage.objects;
create policy community_media_owner_update on storage.objects
  for update using (bucket_id = 'community-media' and owner = auth.uid());
drop policy if exists community_media_owner_delete on storage.objects;
create policy community_media_owner_delete on storage.objects
  for delete using (bucket_id = 'community-media' and owner = auth.uid());
