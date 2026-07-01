import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProfile, type UserProfile } from '@features/onboarding';
import { currentUserId, fetchStrengthEstimates, fetchUserBadges } from '../repositories/strength';
import type { StrengthEstimateRow, UserBadgeRow } from '../schemas';
import { LIFTS, LIFT_IDS, type LiftId } from '../config/lifts';
import type { StrengthLevel } from '../config/levels';
import {
  classifyLift,
  liftScore,
  progressToNextLevel,
  toClassifiableSex,
  type LevelClassification,
  type NextLevelProgress,
} from '../lib/classify';
import { compositeScore, type CompositeResult } from '../lib/composite';

export const STRENGTH_KEYS = {
  estimates: ['strength', 'estimates'] as const,
  badges: ['strength', 'badges'] as const,
};

export function useStrengthEstimates() {
  return useQuery<StrengthEstimateRow[]>({
    queryKey: STRENGTH_KEYS.estimates,
    staleTime: 60_000,
    queryFn: async () => {
      const userId = await currentUserId();
      if (!userId) return [];
      return fetchStrengthEstimates(userId);
    },
  });
}

export function useUserBadges() {
  return useQuery<UserBadgeRow[]>({
    queryKey: STRENGTH_KEYS.badges,
    staleTime: 60_000,
    queryFn: async () => {
      const userId = await currentUserId();
      if (!userId) return [];
      return fetchUserBadges(userId);
    },
  });
}

/** Per-lift view the Strength screen renders. */
export interface LiftView {
  liftId: LiftId;
  exerciseId: string | null;
  estOneRmKg: number;
  bestWeightKg: number;
  bestReps: number;
  level: StrengthLevel | null;
  ratio: number | null;
  progress: NextLevelProgress | null;
  hasData: boolean;
}

export interface StrengthOverview {
  composite: CompositeResult;
  lifts: LiftView[];
  hasAnyData: boolean;
  /** Sex + bodyweight both known → levels can be classified. */
  canClassify: boolean;
  needsBodyweight: boolean;
  needsSex: boolean;
}

/**
 * Pure builder (exported for testing): turns persisted estimate rows + the
 * profile into the per-lift views and composite score. Classification is
 * recomputed from the *current* profile bodyweight so the progress bars always
 * reflect the user's latest weigh-in, even before the next recompute lands.
 */
export function buildStrengthOverview(
  estimates: readonly StrengthEstimateRow[],
  profile: UserProfile | null | undefined,
): StrengthOverview {
  const byLift = new Map<LiftId, StrengthEstimateRow>(
    estimates.map((e) => [e.lift_id as LiftId, e]),
  );
  const sex = toClassifiableSex(profile?.sex ?? null);
  const bodyweightKg = profile?.weight_kg && profile.weight_kg > 0 ? profile.weight_kg : null;
  const canClassify = sex !== null && bodyweightKg !== null;

  const compositeInputs: { weight: number; score: number }[] = [];
  let hasAnyData = false;

  const lifts: LiftView[] = LIFT_IDS.map((liftId) => {
    const row = byLift.get(liftId);
    if (!row || row.est_one_rm_kg <= 0) {
      return {
        liftId,
        exerciseId: null,
        estOneRmKg: 0,
        bestWeightKg: 0,
        bestReps: 0,
        level: null,
        ratio: null,
        progress: null,
        hasData: false,
      };
    }
    hasAnyData = true;
    const estOneRmKg = row.est_one_rm_kg;

    let classification: LevelClassification | null = null;
    let progress: NextLevelProgress | null = null;
    if (canClassify && bodyweightKg && sex) {
      classification = classifyLift(estOneRmKg, bodyweightKg, sex, liftId);
      if (classification) {
        progress = progressToNextLevel(estOneRmKg, bodyweightKg, classification);
        compositeInputs.push({
          weight: LIFTS[liftId].compositeWeight,
          score: liftScore(classification, progress),
        });
      }
    }

    return {
      liftId,
      exerciseId: row.exercise_id,
      estOneRmKg,
      bestWeightKg: row.best_weight_kg,
      bestReps: row.best_reps,
      level: classification?.level ?? row.level,
      ratio: classification?.ratio ?? row.bodyweight_ratio,
      progress,
      hasData: true,
    };
  });

  return {
    composite: compositeScore(compositeInputs),
    lifts,
    hasAnyData,
    canClassify,
    needsBodyweight: bodyweightKg === null,
    needsSex: sex === null,
  };
}

export interface UseStrengthOverviewResult extends StrengthOverview {
  isLoading: boolean;
  weightUnit: 'kg' | 'lb';
}

export function useStrengthOverview(): UseStrengthOverviewResult {
  const estimates = useStrengthEstimates();
  const profile = useProfile();

  const overview = useMemo(
    () => buildStrengthOverview(estimates.data ?? [], profile.data),
    [estimates.data, profile.data],
  );

  return {
    ...overview,
    isLoading: estimates.isLoading || profile.isLoading,
    weightUnit: profile.data?.weight_unit ?? 'kg',
  };
}
