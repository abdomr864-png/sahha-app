import type { LiftId } from '../config/lifts';
import {
  STRENGTH_LEVELS,
  RATED_LEVELS,
  levelIndex,
  nextLevel,
  type StrengthLevel,
} from '../config/levels';
import { bodyweightAdjustment, standardsFor, type ClassifiableSex } from '../config/standards';

/**
 * Maps the profile sex enum ('male' | 'female' | 'other' | null) onto a sex we
 * have published standards for. 'other'/null are not classifiable — callers
 * must prompt rather than defaulting to a sex.
 */
export function toClassifiableSex(
  sex: 'male' | 'female' | 'other' | null | undefined,
): ClassifiableSex | null {
  return sex === 'male' || sex === 'female' ? sex : null;
}

export interface LevelClassification {
  level: StrengthLevel;
  /** e1RM / bodyweight that produced the level. */
  ratio: number;
  /** Bodyweight-adjusted thresholds actually used (for progress maths). */
  thresholds: Record<StrengthLevel, number>;
}

/**
 * Bodyweight-multiple thresholds for entering each level, including the
 * implicit `beginner` floor at 0, with the optional bodyweight correction
 * applied so progress maths and classification share one source of numbers.
 */
export function resolveThresholds(
  sex: ClassifiableSex,
  liftId: LiftId,
  bodyweightKg: number,
): Record<StrengthLevel, number> {
  const base = standardsFor(sex, liftId);
  const adj = bodyweightAdjustment(bodyweightKg, sex);
  return {
    beginner: 0,
    novice: base.novice * adj,
    intermediate: base.intermediate * adj,
    advanced: base.advanced * adj,
    elite: base.elite * adj,
  };
}

/**
 * Classify an estimated 1RM into a strength level using the bodyweight ratio.
 * Returns null when inputs can't yield a ratio (no/zero bodyweight).
 */
export function classifyLift(
  estOneRmKg: number,
  bodyweightKg: number,
  sex: ClassifiableSex,
  liftId: LiftId,
): LevelClassification | null {
  if (bodyweightKg <= 0 || estOneRmKg < 0) return null;
  const ratio = estOneRmKg / bodyweightKg;
  const thresholds = resolveThresholds(sex, liftId, bodyweightKg);

  // Walk down from the top: the first threshold the ratio meets is the level.
  let level: StrengthLevel = 'beginner';
  for (const candidate of RATED_LEVELS) {
    if (ratio >= thresholds[candidate]) level = candidate;
  }

  return { level, ratio, thresholds };
}

export interface NextLevelProgress {
  current: StrengthLevel;
  next: StrengthLevel | null;
  /** 0–1 progress from the current tier's entry toward the next tier's entry. */
  fraction: number;
  /** Estimated 1RM needed to reach the next tier (kg). Null when at elite. */
  nextTargetKg: number | null;
  /** Additional kg still required (>= 0). Null when at elite. */
  remainingKg: number | null;
}

/**
 * Progress of an estimate toward the next level, expressed both as a 0–1
 * fraction (for the bar) and the exact extra kilos needed (for the label).
 *
 * `fraction` is measured between the current tier's entry weight and the next
 * tier's entry weight, so a freshly-promoted lift reads ~0% and one about to
 * promote reads ~100%.
 */
export function progressToNextLevel(
  estOneRmKg: number,
  bodyweightKg: number,
  classification: LevelClassification,
): NextLevelProgress {
  const { level, thresholds } = classification;
  const next = nextLevel(level);

  if (next === null) {
    return { current: level, next: null, fraction: 1, nextTargetKg: null, remainingKg: null };
  }

  const currentEntryKg = thresholds[level] * bodyweightKg;
  const nextEntryKg = thresholds[next] * bodyweightKg;
  const span = nextEntryKg - currentEntryKg;
  const fraction = span > 0 ? clamp01((estOneRmKg - currentEntryKg) / span) : 0;
  const remainingKg = Math.max(0, nextEntryKg - estOneRmKg);

  return { current: level, next, fraction, nextTargetKg: nextEntryKg, remainingKg };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Continuous 0–4 strength score for one lift: the level index plus the
 * fractional progress toward the next tier. Used by the composite score so a
 * "high intermediate" outranks a "low intermediate".
 */
export function liftScore(
  classification: LevelClassification,
  progress: NextLevelProgress,
): number {
  const base = levelIndex(classification.level);
  const frac = progress.next === null ? 0 : progress.fraction;
  return base + frac;
}

/** Inverse of `liftScore`: snap a 0–4 score back to the nearest floor level. */
export function scoreToLevel(score: number): StrengthLevel {
  const idx = Math.max(0, Math.min(STRENGTH_LEVELS.length - 1, Math.floor(score)));
  return STRENGTH_LEVELS[idx] as StrengthLevel;
}
