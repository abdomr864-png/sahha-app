/**
 * Types for the recovery / readiness system. The pure math modules
 * (baseline.ts, score.ts, acwr.ts) and the hooks all share these shapes.
 */

/** HRV measurement variant — never compare across variants (see types.ts/MetricType). */
export type HrvVariant = 'SDNN' | 'RMSSD';

/** A rolling baseline (mean + sample SD) for one metric over the window. */
export interface Baseline {
  mean: number;
  /** Sample standard deviation. 0 when there is no spread. */
  sd: number;
  /** Number of daily samples the baseline was built from. */
  n: number;
}

/** Per-metric baselines used for deviation scoring. */
export interface RecoveryBaselines {
  restingHr: Baseline | null;
  /** HRV baseline, paired with the variant it was computed from (never mixed). */
  hrv: (Baseline & { variant: HrvVariant }) | null;
  sleep: Baseline | null;
  /** True once at least one metric meets the minimum-history bar. */
  ready: boolean;
  /**
   * True when there IS some wearable HRV/RHR/sleep history but none has reached
   * the minimum-history bar yet. Distinguishes "data is accumulating, show
   * building" from "no wearable at all, degrade to sleep + load". When `ready`
   * is true this is irrelevant.
   */
  partial: boolean;
}

/** Today's raw inputs for the score (any may be absent without a wearable). */
export interface RecoveryInputs {
  restingHr: number | null;
  hrv: number | null;
  hrvVariant: HrvVariant | null;
  sleepMinutes: number | null;
  /** The user's personalized nightly sleep goal, in minutes. */
  sleepGoalMin: number;
  /** Acute:chronic workload ratio, or null when there isn't enough training history. */
  acwr: number | null;
}

export type RecoveryBand = 'recovered' | 'moderate' | 'fatigued';

/** A single contributing factor, surfaced in the UI as "vs your baseline". */
export interface RecoveryFactor {
  key: 'hrv' | 'restingHr' | 'sleep' | 'load';
  /** 0..1 normalized contribution (higher = better recovery). */
  signal: number;
  /** Weight actually applied (after dropping unavailable signals). */
  weight: number;
  /** Signed deviation vs baseline/goal in the metric's own terms, for display. */
  deltaLabel: 'above' | 'below' | 'at' | 'na';
  available: boolean;
}

export interface RecoveryScore {
  /** 0-100, or null when the baseline isn't ready yet. */
  score: number | null;
  band: RecoveryBand | null;
  factors: RecoveryFactor[];
  /** True until enough history exists — UI shows "building your baseline". */
  building: boolean;
}

/** Acute:chronic workload computation output. */
export interface AcwrResult {
  /** Mean daily load over the acute window. */
  acute: number;
  /** Mean daily load over the chronic window. */
  chronic: number;
  /** acute / chronic, or null when chronic load is 0 / insufficient. */
  ratio: number | null;
}

export type DeloadReason = 'acwr' | 'suppressed' | null;

export interface DeloadRecommendation {
  recommend: boolean;
  reason: DeloadReason;
  /** ACWR value when reason is 'acwr', else null. */
  acwr: number | null;
  /** Consecutive suppressed days when reason is 'suppressed', else 0. */
  suppressedDays: number;
}
