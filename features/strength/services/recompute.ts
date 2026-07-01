import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import { LIFT_IDS, STRENGTH_CONFIG, type LiftId } from '../config/lifts';
import { levelIndex, type RatedLevel, type StrengthLevel } from '../config/levels';
import { getBadge } from '../config/badges';
import { epleyOneRepMax, isEstimableSet, roundEstimate } from '../lib/oneRepMax';
import { classifyLift, toClassifiableSex } from '../lib/classify';
import { newlyEarnedBadges, type BadgeContext } from '../lib/badges';
import {
  awardBadges,
  currentUserId,
  fetchRecentMainLiftSets,
  fetchStrengthEstimates,
  fetchUserBadges,
  resolveExerciseLiftMap,
  upsertStrengthEstimates,
  type MainLiftSetRow,
  type StrengthEstimateUpsert,
} from '../repositories/strength';

export interface LevelUpEvent {
  liftId: LiftId;
  from: StrengthLevel | null;
  to: RatedLevel;
}

export interface RecomputeResult {
  /** Whether any estimable data existed (false → "log a few sets" UI). */
  hasData: boolean;
  /** Lifts that climbed a tier since the previous estimate. */
  levelUps: LevelUpEvent[];
  /** Badge ids awarded for the first time on this run. */
  newBadges: string[];
}

const EMPTY_RESULT: RecomputeResult = { hasData: false, levelUps: [], newBadges: [] };

interface BestPerLift {
  estOneRmKg: number;
  bestWeightKg: number;
  bestReps: number;
  exerciseId: string | null;
}

/** Best Epley estimate per lift, tracking the exercise variant behind it. */
function bestEstimatesPerLift(
  sets: readonly MainLiftSetRow[],
  liftOf: Map<string, LiftId>,
): Map<LiftId, BestPerLift> {
  const out = new Map<LiftId, BestPerLift>();
  for (const row of sets) {
    const liftId = liftOf.get(row.exerciseId);
    if (!liftId) continue;
    if (
      !isEstimableSet({
        weightKg: row.weightKg,
        reps: row.reps,
        performedAt: row.performedAt,
        isWarmup: row.isWarmup,
      })
    ) {
      continue;
    }
    const est = epleyOneRepMax(row.weightKg, row.reps);
    const prev = out.get(liftId);
    if (
      !prev ||
      est > prev.estOneRmKg ||
      (est === prev.estOneRmKg && row.weightKg > prev.bestWeightKg)
    ) {
      out.set(liftId, {
        estOneRmKg: est,
        bestWeightKg: row.weightKg,
        bestReps: row.reps,
        exerciseId: row.exerciseId,
      });
    }
  }
  return out;
}

/**
 * Recompute every per-lift estimate and badge for the current user from their
 * logged sets, persist the results, and return what changed so the UI can
 * celebrate. Safe and idempotent to call repeatedly (e.g. on Home focus).
 *
 * Bootstrapping note: the very first run for a user (no prior estimates) seeds
 * the tables WITHOUT emitting level-ups/badges, so importing a long history
 * doesn't trigger a celebration storm. Subsequent gains celebrate normally.
 */
export async function recomputeStrength(): Promise<RecomputeResult> {
  const userId = await currentUserId();
  if (!userId) return EMPTY_RESULT;

  const [profile, priorEstimates, priorBadges, liftOf] = await Promise.all([
    fetchProfileBasics(userId),
    fetchStrengthEstimates(userId),
    fetchUserBadges(userId),
    resolveExerciseLiftMap(),
  ]);

  const sets = await fetchRecentMainLiftSets(userId, STRENGTH_CONFIG.windowDays);
  const best = bestEstimatesPerLift(sets, liftOf);

  if (best.size === 0) {
    // No estimable data in-window. Keep any prior estimates as-is.
    return { ...EMPTY_RESULT, hasData: priorEstimates.length > 0 };
  }

  const sex = toClassifiableSex(profile.sex);
  const bodyweightKg = profile.weightKg && profile.weightKg > 0 ? profile.weightKg : null;
  const canClassify = sex !== null && bodyweightKg !== null;

  const priorLevel = new Map<LiftId, StrengthLevel | null>(
    priorEstimates.map((e) => [e.lift_id as LiftId, e.level]),
  );

  const upserts: StrengthEstimateUpsert[] = [];
  const badgeByLift: BadgeContext['byLift'] = {};
  const levelUps: LevelUpEvent[] = [];
  const computedAt = new Date().toISOString();
  const isBootstrap = priorEstimates.length === 0;

  for (const liftId of LIFT_IDS) {
    const b = best.get(liftId);
    if (!b) continue;

    const estOneRmKg = roundEstimate(b.estOneRmKg);
    const classification =
      canClassify && bodyweightKg ? classifyLift(estOneRmKg, bodyweightKg, sex, liftId) : null;
    const level = classification?.level ?? null;
    const ratio = classification ? Math.round(classification.ratio * 100) / 100 : null;

    upserts.push({
      user_id: userId,
      lift_id: liftId,
      exercise_id: b.exerciseId,
      est_one_rm_kg: estOneRmKg,
      best_weight_kg: b.bestWeightKg,
      best_reps: b.bestReps,
      level,
      bodyweight_ratio: ratio,
      bodyweight_kg: bodyweightKg,
      computed_at: computedAt,
    });

    badgeByLift[liftId] = { estOneRmKg, level };

    if (!isBootstrap && level && level !== 'beginner') {
      const prev = priorLevel.get(liftId) ?? null;
      const climbed = prev === null ? false : levelIndex(level) > levelIndex(prev);
      // Only celebrate a genuine tier increase over a known prior level.
      if (climbed) levelUps.push({ liftId, from: prev, to: level as RatedLevel });
    }
  }

  await upsertStrengthEstimates(upserts);

  // Badges.
  const ctx: BadgeContext = { byLift: badgeByLift, bodyweightKg };
  const alreadyEarned = new Set(priorBadges.map((p) => p.badge_id));
  const fresh = newlyEarnedBadges(ctx, alreadyEarned);
  if (fresh.length > 0) {
    await awardBadges(
      userId,
      fresh.map((id) => ({ badge_id: id, meta: badgeMeta(id, badgeByLift) })),
    );
  }
  const newBadges = isBootstrap ? [] : fresh;

  return { hasData: true, levelUps, newBadges };
}

function badgeMeta(
  badgeId: string,
  byLift: BadgeContext['byLift'],
): Record<string, unknown> | null {
  const badge = getBadge(badgeId);
  if (badge?.kind === 'level') {
    const e = byLift[badge.liftId]?.estOneRmKg ?? 0;
    return { liftId: badge.liftId, level: badge.level, estOneRmKg: e };
  }
  return null;
}

interface ProfileBasics {
  sex: 'male' | 'female' | 'other' | null;
  weightKg: number | null;
}

async function fetchProfileBasics(userId: string): Promise<ProfileBasics> {
  const { data, error } = await supabase
    .from('profiles')
    .select('sex,weight_kg')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return {
    sex: (data?.sex as ProfileBasics['sex']) ?? null,
    weightKg: data?.weight_kg != null ? Number(data.weight_kg) : null,
  };
}
