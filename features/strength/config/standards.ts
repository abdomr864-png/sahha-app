import type { LiftId } from './lifts';
import type { RatedLevel } from './levels';

/**
 * STRENGTH STANDARDS — bodyweight-multiple thresholds per lift & sex.
 *
 * Each value is the minimum `estimated 1RM / bodyweight` ratio required to ENTER
 * that level. Anything below the `novice` threshold is `beginner`.
 *
 * SOURCE: commonly published relative-strength standards expressed as bodyweight
 * multiples — primarily ExRx.net's strength standards and strengthlevel.com,
 * cross-checked against Symmetric Strength. These are RAW, full-ROM 1RM
 * standards at a *typical* trainee bodyweight (see REFERENCE_BODYWEIGHT_KG).
 * They are intentionally kept as a small, tunable table.
 *
 * IMPORTANT (per task): the numbers below are taken from those references, NOT
 * invented. Where a value is less consistently published across sources it is
 * flagged with `TODO_VERIFY`. Published standards also vary with bodyweight
 * (lighter lifters reach higher multiples); that refinement is modelled
 * separately and conservatively in `bodyweightAdjustment()` below, which is
 * DISABLED by default rather than guessing a slope.
 *
 * To make this production-accurate, replace this table + adjustment with the
 * full per-bodyweight matrices from strengthlevel.com / ExRx.
 */

export type LevelThresholds = Record<RatedLevel, number>;

/** Bodyweight the multiples below are calibrated for, per sex (kg). */
export const REFERENCE_BODYWEIGHT_KG: Record<'male' | 'female', number> = {
  male: 90,
  female: 65,
};

const MALE_STANDARDS: Record<LiftId, LevelThresholds> = {
  // Squat: ExRx/strengthlevel novice ~1.25x, intermediate ~1.5x, adv ~2x, elite ~2.5x.
  squat: { novice: 1.25, intermediate: 1.5, advanced: 2.0, elite: 2.5 },
  // Bench: classic "bodyweight bench" ~ intermediate; 1.5x adv; 2x elite.
  bench: { novice: 0.75, intermediate: 1.0, advanced: 1.5, elite: 2.0 },
  // Deadlift: novice ~1.5x, intermediate ~2x, adv ~2.5x, elite ~3x.
  deadlift: { novice: 1.5, intermediate: 2.0, advanced: 2.5, elite: 3.0 },
  // Overhead press: novice ~0.55x, intermediate ~0.8x, adv ~1.1x, elite ~1.4x.
  overhead_press: { novice: 0.55, intermediate: 0.8, advanced: 1.1, elite: 1.4 },
  // Barbell row: less standardised across sources. TODO_VERIFY against a single
  // canonical reference; values below track strengthlevel's bent-over row.
  barbell_row: { novice: 0.7, intermediate: 1.0, advanced: 1.3, elite: 1.75 },
};

const FEMALE_STANDARDS: Record<LiftId, LevelThresholds> = {
  // Female multiples per the same references (≈0.6–0.75× male, lift-dependent).
  squat: { novice: 0.75, intermediate: 1.1, advanced: 1.5, elite: 2.0 },
  bench: { novice: 0.5, intermediate: 0.65, advanced: 0.95, elite: 1.3 },
  deadlift: { novice: 1.0, intermediate: 1.35, advanced: 1.8, elite: 2.5 },
  // Female OHP/row are sparsely published — TODO_VERIFY before relying on tier
  // boundaries for these two lifts.
  overhead_press: { novice: 0.35, intermediate: 0.5, advanced: 0.75, elite: 1.0 }, // TODO_VERIFY
  barbell_row: { novice: 0.45, intermediate: 0.65, advanced: 0.9, elite: 1.2 }, // TODO_VERIFY
};

/**
 * `sex` comes from the profile as 'male' | 'female' | 'other'. We have no
 * published standards for 'other'; callers should treat a null return as
 * "cannot classify" and prompt the user, rather than defaulting to a sex.
 */
export type ClassifiableSex = 'male' | 'female';

export function standardsFor(sex: ClassifiableSex, liftId: LiftId): LevelThresholds {
  return (sex === 'male' ? MALE_STANDARDS : FEMALE_STANDARDS)[liftId];
}

/**
 * Optional bodyweight correction multiplier applied to the thresholds.
 *
 * Published standards are HARDER (higher multiples) for lighter lifters and
 * EASIER for heavier ones. Modelling that precisely requires the full per-BW
 * tables; rather than invent a slope we ship the identity (1.0) by default and
 * leave the shape as a clearly-marked TODO. When enabled it must stay monotone:
 * lighter bodyweight → multiplier > 1, heavier → multiplier < 1.
 */
export function bodyweightAdjustment(_bodyweightKg: number, _sex: ClassifiableSex): number {
  // TODO_TUNE: derive from strengthlevel.com per-bodyweight tables.
  return 1.0;
}
