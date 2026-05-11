-- AI coach continuity: per-conversation rolling memory + last-message preview.
-- `memory_summary` is a coach-written digest of older turns that get dropped
-- from the context window, so the assistant keeps long-term continuity even
-- after dozens of messages. `last_message_preview` powers the list UI without
-- forcing an extra query per row.

alter table ai_conversations
  add column if not exists memory_summary text,
  add column if not exists last_message_preview text,
  add column if not exists message_count int not null default 0;

create index if not exists ai_conv_user_last_msg_idx
  on ai_conversations (user_id, last_message_at desc);
