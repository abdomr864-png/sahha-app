import { ALL_BADGES, levelBadgeId, type BadgeDef } from '../config/badges';
import { LIFT_IDS, type LiftId } from '../config/lifts';
import { RATED_LEVELS, levelIndex, type StrengthLevel } from '../config/levels';

export interface LiftBadgeState {
  estOneRmKg: number;
  level: StrengthLevel | null;
}

export interface BadgeContext {
  byLift: Partial<Record<LiftId, LiftBadgeState>>;
  bodyweightKg: number | null;
}

function maxE1rm(ctx: BadgeContext): number {
  let max = 0;
  for (const id of LIFT_IDS) {
    const e = ctx.byLift[id]?.estOneRmKg ?? 0;
    if (e > max) max = e;
  }
  return max;
}

function hasAnyEstimate(ctx: BadgeContext): boolean {
  return LIFT_IDS.some((id) => (ctx.byLift[id]?.estOneRmKg ?? 0) > 0);
}

/** Whether a single badge's condition is currently satisfied. */
export function isBadgeEarned(badge: BadgeDef, ctx: BadgeContext): boolean {
  if (badge.kind === 'level') {
    const liftLevel = ctx.byLift[badge.liftId]?.level ?? null;
    if (liftLevel === null) return false;
    return levelIndex(liftLevel) >= levelIndex(badge.level);
  }

  switch (badge.rule.type) {
    case 'first_estimate':
      return hasAnyEstimate(ctx);
    case 'absolute_e1rm_any':
      return maxE1rm(ctx) >= badge.rule.kg;
    case 'bodyweight_ratio': {
      if (ctx.bodyweightKg == null || ctx.bodyweightKg <= 0) return false;
      const e = ctx.byLift[badge.rule.liftId]?.estOneRmKg ?? 0;
      return e >= badge.rule.ratio * ctx.bodyweightKg;
    }
  }
}

/** All badge ids whose condition the context currently satisfies. */
export function evaluateBadges(ctx: BadgeContext): string[] {
  return ALL_BADGES.filter((b) => isBadgeEarned(b, ctx)).map((b) => b.id);
}

/**
 * Newly-earned badge ids = currently-satisfied minus already-persisted. Used by
 * the recompute service to award exactly the new badges (idempotent) and to
 * decide what to celebrate.
 */
export function newlyEarnedBadges(ctx: BadgeContext, alreadyEarned: ReadonlySet<string>): string[] {
  return evaluateBadges(ctx).filter((id) => !alreadyEarned.has(id));
}

/** Re-export for callers building level-badge ids without importing config. */
export { levelBadgeId, RATED_LEVELS };
