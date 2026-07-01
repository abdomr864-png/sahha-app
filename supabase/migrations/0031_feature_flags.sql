-- ============================================================================
-- 0031_feature_flags — remote kill-switch for the Pro feature clusters.
--
-- Each new Pro cluster (readiness, progression intelligence, adaptive nutrition,
-- weekly insights, imbalance radar, platform widgets) ships behind a flag so it
-- can be rolled out / rolled back independently WITHOUT an app release.
--
-- The app holds a typed local default for every flag (features/feature-flags/
-- config.ts) so it works instantly and offline; this table is an OPTIONAL
-- override. A missing row → use the local default. A present row → its `enabled`
-- value wins. Global config (not per-user): public read, admin-only write, same
-- pattern as `entitlement_rules` (0009) + the admin role (0025).
--
-- Idempotent. Rollback: `drop table if exists feature_flags;`
-- ============================================================================

create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default true,
  description text,
  updated_at timestamptz not null default now()
);

alter table feature_flags enable row level security;

-- Anyone signed in (and anon, mirroring entitlement_rules) may read flags.
drop policy if exists feature_flags_read_all on feature_flags;
create policy feature_flags_read_all on feature_flags
  for select using (true);

-- Only admins may change them (is_admin() from 0025_admin_role).
drop policy if exists feature_flags_admin_write on feature_flags;
create policy feature_flags_admin_write on feature_flags
  for all to authenticated using (is_admin()) with check (is_admin());

-- Seed the known cluster flags. Readiness (Phase 1) ships ON; the rest default
-- OFF until their cluster lands, so a half-built feature never surfaces. These
-- mirror the keys in features/feature-flags/config.ts — keep them in sync.
insert into feature_flags (key, enabled, description) values
  ('readiness',         true,  'Daily readiness verdict + load adjustment (Pro)'),
  ('progression_intel', false, 'Next-set suggestions, plateau detection, PR projection (Pro)'),
  ('adaptive_nutrition',false, 'Load-scaled macro targets + Ramadan mode (Pro)'),
  ('weekly_insights',   false, 'AI weekly review narrative (Pro)'),
  ('imbalance_radar',   false, 'Push/pull, posterior-chain & L/R imbalance flags (Pro)'),
  ('platform_widgets',  false, 'Home-screen widget, Live Activity, complications')
on conflict (key) do nothing;
