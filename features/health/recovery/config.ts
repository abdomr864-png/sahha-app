/**
 * All tunable thresholds for the recovery / readiness system live here so the
 * scoring, baseline, and deload logic stay pure and data-driven. Nothing in
 * baseline.ts / score.ts / acwr.ts should hard-code a number that belongs here.
 */

export interface RecoveryConfig {
  /** Days of history fetched to compute rolling baselines. */
  readonly baselineWindowDays: number;
  /**
   * Minimum number of daily samples (per metric) required before we trust a
   * baseline enough to score against it. Below this we show "building your
   * baseline" instead of a score.
   */
  readonly minHistoryDays: number;
  /**
   * Z-scores are clamped to ±zClamp before being mapped to a 0..1 signal, so a
   * single freak reading can't swing the whole score.
   */
  readonly zClamp: number;
  /** Relative weights of each readiness signal (need not sum to 1 — normalized). */
  readonly weights: {
    readonly hrv: number;
    readonly restingHr: number;
    readonly sleep: number;
    readonly load: number;
  };
  /** Score (0-100) band cutoffs. >= recovered → Recovered, >= moderate → Moderate. */
  readonly bands: {
    readonly recovered: number;
    readonly moderate: number;
  };
  readonly acwr: {
    /** Acute window (recent load), in days. */
    readonly acuteDays: number;
    /** Chronic window (baseline load), in days. */
    readonly chronicDays: number;
    /** ACWR at/above this is the "danger zone" → deload trigger. */
    readonly deloadThreshold: number;
    /** Sweet-spot upper bound — at/below this the load signal is full marks. */
    readonly sweetSpotHigh: number;
    /** ACWR at/above this maps the load signal to 0 (fully penalized). */
    readonly penaltyCeiling: number;
  };
  readonly deload: {
    /** A day counts as "suppressed" when its score is at/below this. */
    readonly suppressedScore: number;
    /** Consecutive suppressed days (incl. today) that trigger a deload nudge. */
    readonly consecutiveDays: number;
  };
}

export const RECOVERY_CONFIG: RecoveryConfig = {
  baselineWindowDays: 28,
  minHistoryDays: 7,
  zClamp: 2,
  // HRV carries the most signal; resting HR next; sleep and acute load round it
  // out. When a signal is unavailable (no wearable) its weight is dropped and
  // the remainder re-normalized — see score.ts.
  weights: { hrv: 0.4, restingHr: 0.25, sleep: 0.2, load: 0.15 },
  bands: { recovered: 67, moderate: 40 },
  acwr: {
    acuteDays: 7,
    chronicDays: 28,
    deloadThreshold: 1.5,
    sweetSpotHigh: 1.3,
    penaltyCeiling: 2.0,
  },
  deload: {
    suppressedScore: 40, // i.e. a "Fatigued" day
    consecutiveDays: 3,
  },
};
