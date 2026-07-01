import { STRENGTH_CONFIG } from '../config/lifts';

/** A single logged working set, reduced to what 1RM estimation needs. */
export interface EstimationSet {
  weightKg: number;
  reps: number;
  /** ISO timestamp the set was completed at. */
  performedAt: string;
  isWarmup?: boolean;
}

/**
 * Epley one-rep-max estimate: `1RM = w × (1 + reps/30)`.
 *
 * At 1 rep this returns the weight unchanged. Returns 0 for non-positive
 * weight/reps so empty or malformed sets never inflate an estimate.
 */
export function epleyOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

/**
 * Whether a set is eligible to inform a 1RM estimate: real load & reps, reps
 * within the range Epley is reliable for, and (by config) not a warm-up.
 */
export function isEstimableSet(set: EstimationSet): boolean {
  if (set.weightKg <= 0 || set.reps <= 0) return false;
  if (set.reps > STRENGTH_CONFIG.maxRepsForEstimate) return false;
  if (!STRENGTH_CONFIG.includeWarmups && set.isWarmup) return false;
  return true;
}

export interface BestEstimate {
  estOneRmKg: number;
  /** The set that produced the best estimate. */
  weightKg: number;
  reps: number;
  performedAt: string;
}

/**
 * Best Epley estimate across the eligible sets performed within `windowDays`
 * of `now`. Returns null when no set qualifies (too little / too old data).
 *
 * Ties on estimate are broken toward the heavier top-set, which is the more
 * meaningful PR to surface.
 */
export function bestEstimateInWindow(
  sets: readonly EstimationSet[],
  now: Date = new Date(),
  windowDays: number = STRENGTH_CONFIG.windowDays,
): BestEstimate | null {
  const cutoff = now.getTime() - windowDays * 86_400_000;
  let best: BestEstimate | null = null;

  for (const set of sets) {
    if (!isEstimableSet(set)) continue;
    const ts = new Date(set.performedAt).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;

    const est = epleyOneRepMax(set.weightKg, set.reps);
    if (
      best === null ||
      est > best.estOneRmKg ||
      (est === best.estOneRmKg && set.weightKg > best.weightKg)
    ) {
      best = {
        estOneRmKg: est,
        weightKg: set.weightKg,
        reps: set.reps,
        performedAt: set.performedAt,
      };
    }
  }

  return best;
}

/** Round an estimate to a sane display precision (0.1kg). */
export function roundEstimate(kg: number): number {
  return Math.round(kg * 10) / 10;
}
