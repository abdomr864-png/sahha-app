/**
 * Typed local defaults for every Pro feature cluster. This is the source of
 * truth the app reads instantly and offline; the `feature_flags` Supabase table
 * (migration 0031) is an OPTIONAL remote override / kill-switch layered on top
 * by useFeatureFlag.
 *
 * Keep these keys in sync with the seed rows in 0031_feature_flags.sql.
 *
 * Each cluster from the Pro build spec gets exactly one flag so it can ship and
 * roll back independently. A cluster ships OFF here until its code lands, then
 * flips ON in a follow-up — that way a half-built feature never surfaces.
 */
export const FEATURE_FLAGS = {
  /** Feature 1 — daily readiness verdict + load adjustment. Phase 1, shipped. */
  readiness: true,
  /** Feature 2 — next-set suggestions, plateau detection, PR projection. */
  progression_intel: false,
  /** Feature 3 — load-scaled macro targets + Ramadan mode. */
  adaptive_nutrition: false,
  /** Feature 4 — AI weekly review narrative. */
  weekly_insights: false,
  /** Feature 5 — push/pull, posterior-chain & left/right imbalance flags. */
  imbalance_radar: false,
  /** Feature 6 — home-screen widget, Live Activity, watch complications. */
  platform_widgets: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/** All flag keys, handy for prefetching / iterating. */
export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];
