-- Follows, posts, likes, comments, leaderboards

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on follows (followed_id);
alter table follows enable row level security;
drop policy if exists follows_read_any on follows;
create policy follows_read_any on follows for select using (true);
drop policy if exists follows_self_insert on follows;
create policy follows_self_insert on follows
  for insert with check (follower_id = auth.uid());
drop policy if exists follows_self_delete on follows;
create policy follows_self_delete on follows
  for delete using (follower_id = auth.uid());

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type post_kind not null,
  workout_id uuid references workouts(id) on delete set null,
  content text,
  created_at timestamptz not null default now()
);
create index if not exists posts_user_created_idx on posts (user_id, created_at desc);
alter table posts enable row level security;

drop policy if exists posts_read_followed_or_public on posts;
create policy posts_read_followed_or_public on posts
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p where p.user_id = posts.user_id and p.is_public = true
    )
    or exists (
      select 1 from follows f where f.follower_id = auth.uid() and f.followed_id = posts.user_id
    )
  );

drop policy if exists posts_self_write on posts;
create policy posts_self_write on posts
  for insert with check (user_id = auth.uid());
drop policy if exists posts_self_update on posts;
create policy posts_self_update on posts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists posts_self_delete on posts;
create policy posts_self_delete on posts
  for delete using (user_id = auth.uid());

create table if not exists post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table post_likes enable row level security;
drop policy if exists post_likes_read_via_post on post_likes;
create policy post_likes_read_via_post on post_likes
  for select using (
    exists (select 1 from posts p where p.id = post_id)
  );
drop policy if exists post_likes_self_write on post_likes;
create policy post_likes_self_write on post_likes
  for insert with check (user_id = auth.uid());
drop policy if exists post_likes_self_delete on post_likes;
create policy post_likes_self_delete on post_likes
  for delete using (user_id = auth.uid());

create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on post_comments (post_id, created_at);
alter table post_comments enable row level security;
drop policy if exists post_comments_read_via_post on post_comments;
create policy post_comments_read_via_post on post_comments
  for select using (
    exists (select 1 from posts p where p.id = post_id)
  );
drop policy if exists post_comments_self_write on post_comments;
create policy post_comments_self_write on post_comments
  for insert with check (user_id = auth.uid());
drop policy if exists post_comments_self_update on post_comments;
create policy post_comments_self_update on post_comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists post_comments_self_delete on post_comments;
create policy post_comments_self_delete on post_comments
  for delete using (user_id = auth.uid());

create table if not exists leaderboards_weekly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null,
  value numeric(12,2) not null,
  week_start date not null,
  rank int not null,
  unique (metric, week_start, user_id)
);
create index if not exists lb_metric_week_rank_idx on leaderboards_weekly (metric, week_start, rank);
alter table leaderboards_weekly enable row level security;
drop policy if exists lb_read_all on leaderboards_weekly;
create policy lb_read_all on leaderboards_weekly for select using (true);
