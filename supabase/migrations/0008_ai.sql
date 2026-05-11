-- AI conversations, messages, form checks, program adjustments

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists ai_conv_user_idx on ai_conversations (user_id, last_message_at desc);
alter table ai_conversations enable row level security;
drop policy if exists ai_conv_self_all on ai_conversations;
create policy ai_conv_self_all on ai_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role ai_role not null,
  content text not null,
  tokens_used int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_msg_conv_created_idx on ai_messages (conversation_id, created_at);
alter table ai_messages enable row level security;
drop policy if exists ai_msg_self_all on ai_messages;
create policy ai_msg_self_all on ai_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists ai_form_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  video_url text not null,
  feedback text,
  created_at timestamptz not null default now()
);
create index if not exists fc_user_created_idx on ai_form_checks (user_id, created_at desc);
alter table ai_form_checks enable row level security;
drop policy if exists fc_self_all on ai_form_checks;
create policy fc_self_all on ai_form_checks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists ai_program_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  week smallint not null,
  suggestion jsonb not null,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pa_user_idx on ai_program_adjustments (user_id, created_at desc);
alter table ai_program_adjustments enable row level security;
drop policy if exists pa_self_all on ai_program_adjustments;
create policy pa_self_all on ai_program_adjustments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
