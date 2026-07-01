import type { IconName } from '@features/shared';
import { LIFT_IDS, type LiftId } from './lifts';
import { RATED_LEVELS, type RatedLevel } from './levels';

/**
 * Badges are split into two families:
 *   - `level`     — one per lift per rated level reached (e.g. "Intermediate
 *                   Bench"). Generated from the lift × level matrix.
 *   - `milestone` — absolute / relative achievements (plate clubs, bodyweight
 *                   bench, first PR …). Each carries a declarative `rule` so the
 *                   evaluator (features/strength/lib/badges.ts) stays data-driven
 *                   and unit-testable — no logic lives in this config.
 *
 * Badge ids are STABLE and persisted in `user_badges.badge_id`. Awarding is
 * idempotent (PK on (user_id, badge_id)); these ids must never be reused for a
 * different meaning.
 */

/** Declarative predicate the evaluator interprets against a user's estimates. */
export type MilestoneRule =
  // Any main lift's estimated 1RM reaches `kg` (the "plate club" ladder).
  | { type: 'absolute_e1rm_any'; kg: number }
  // A specific lift's e1RM reaches `ratio` × bodyweight.
  | { type: 'bodyweight_ratio'; liftId: LiftId; ratio: number }
  // The user has at least one computed estimate (their first logged PR).
  | { type: 'first_estimate' };

export interface LevelBadgeDef {
  id: string;
  kind: 'level';
  liftId: LiftId;
  level: RatedLevel;
  icon: IconName;
}

export interface MilestoneBadgeDef {
  id: string;
  kind: 'milestone';
  icon: IconName;
  /** i18n key suffix under `strength.badges.milestone.<key>`. */
  i18nKey: string;
  rule: MilestoneRule;
}

export type BadgeDef = LevelBadgeDef | MilestoneBadgeDef;

const LEVEL_BADGE_ICON: Record<RatedLevel, IconName> = {
  novice: 'shield',
  intermediate: 'medal',
  advanced: 'zap',
  elite: 'crown',
};

export function levelBadgeId(liftId: LiftId, level: RatedLevel): string {
  return `level_${liftId}_${level}`;
}

/** One badge per (lift, rated level): 5 lifts × 4 levels = 20 level badges. */
export const LEVEL_BADGES: readonly LevelBadgeDef[] = LIFT_IDS.flatMap((liftId) =>
  RATED_LEVELS.map(
    (level): LevelBadgeDef => ({
      id: levelBadgeId(liftId, level),
      kind: 'level',
      liftId,
      level,
      icon: LEVEL_BADGE_ICON[level],
    }),
  ),
);

/**
 * Plate-club ladder: 1–4 plates per side on a 20kg barbell.
 *   1 plate = 20 + 2×20 = 60kg, then +40kg per plate → 100 / 140 / 180kg.
 */
export const MILESTONE_BADGES: readonly MilestoneBadgeDef[] = [
  {
    id: 'first_pr',
    kind: 'milestone',
    icon: 'sparkles',
    i18nKey: 'firstPr',
    rule: { type: 'first_estimate' },
  },
  {
    id: 'plate_1',
    kind: 'milestone',
    icon: 'scale',
    i18nKey: 'plate1',
    rule: { type: 'absolute_e1rm_any', kg: 60 },
  },
  {
    id: 'plate_2',
    kind: 'milestone',
    icon: 'scale',
    i18nKey: 'plate2',
    rule: { type: 'absolute_e1rm_any', kg: 100 },
  },
  {
    id: 'plate_3',
    kind: 'milestone',
    icon: 'scale',
    i18nKey: 'plate3',
    rule: { type: 'absolute_e1rm_any', kg: 140 },
  },
  {
    id: 'plate_4',
    kind: 'milestone',
    icon: 'scale',
    i18nKey: 'plate4',
    rule: { type: 'absolute_e1rm_any', kg: 180 },
  },
  {
    id: 'bodyweight_bench',
    kind: 'milestone',
    icon: 'target',
    i18nKey: 'bodyweightBench',
    rule: { type: 'bodyweight_ratio', liftId: 'bench', ratio: 1.0 },
  },
  {
    id: 'squat_1_5x',
    kind: 'milestone',
    icon: 'target',
    i18nKey: 'squat15x',
    rule: { type: 'bodyweight_ratio', liftId: 'squat', ratio: 1.5 },
  },
  {
    id: 'deadlift_2x',
    kind: 'milestone',
    icon: 'flame',
    i18nKey: 'deadlift2x',
    rule: { type: 'bodyweight_ratio', liftId: 'deadlift', ratio: 2.0 },
  },
];

export const ALL_BADGES: readonly BadgeDef[] = [...MILESTONE_BADGES, ...LEVEL_BADGES];

const BADGE_BY_ID: ReadonlyMap<string, BadgeDef> = new Map(ALL_BADGES.map((b) => [b.id, b]));

export function getBadge(id: string): BadgeDef | undefined {
  return BADGE_BY_ID.get(id);
}
