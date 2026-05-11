-- Extend meals with AI-coach fields: photo, verdict, summary.
-- Stored alongside the meal so the home feed can render thumbnails + AI badges.

alter table meals add column if not exists photo_url text;
alter table meals add column if not exists verdict text check (verdict in ('good','ok','bad'));
alter table meals add column if not exists health_score smallint check (health_score between 1 and 10);
alter table meals add column if not exists ai_summary text;
