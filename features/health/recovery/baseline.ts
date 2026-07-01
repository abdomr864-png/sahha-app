/**
 * Pure rolling-baseline math. No I/O — callers pass in the per-day values they
 * read from `health_daily`; this module turns them into a mean/SD baseline and
 * z-scores today's reading against it.
 *
 * HRV is never handled here as a single series: SDNN (iOS) and RMSSD (Android)
 * are different measurements, so the caller passes whichever variant's series
 * matches today's reading and tags it — see RecoveryBaselines.hrv.variant.
 */
import { RECOVERY_CONFIG, type RecoveryConfig } from './config';
import type { Baseline } from './types';

/** Arithmetic mean of a non-empty list. */
function mean(values: number[]): number {
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Build a baseline from a series of daily values. Returns null when there are
 * fewer than `minHistoryDays` samples — the caller treats that as "still
 * building your baseline" rather than scoring against noise.
 *
 * Uses the *sample* standard deviation (n-1 denominator) since these are a
 * sample of the user's days, not the full population. With exactly one extra
 * day over the minimum the n-1 form stays well-defined.
 */
export function buildBaseline(
  values: readonly number[],
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): Baseline | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < cfg.minHistoryDays) return null;
  const m = mean(clean);
  const variance =
    clean.length > 1
      ? clean.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (clean.length - 1)
      : 0;
  return { mean: m, sd: Math.sqrt(variance), n: clean.length };
}

/**
 * Z-score of `today` against a baseline, clamped to ±zClamp. When the baseline
 * has no spread (sd === 0) we return 0 (today is "at baseline") rather than
 * dividing by zero.
 */
export function zScore(
  today: number,
  baseline: Baseline,
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): number {
  if (baseline.sd <= 0) return 0;
  const z = (today - baseline.mean) / baseline.sd;
  return Math.max(-cfg.zClamp, Math.min(cfg.zClamp, z));
}

/**
 * Map a clamped z-score to a 0..1 signal where the baseline mean sits at 0.5.
 * `higherIsBetter = false` inverts it (used for resting HR, where *lower* than
 * baseline means better recovery).
 */
export function zToSignal(
  z: number,
  higherIsBetter: boolean,
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): number {
  const directed = higherIsBetter ? z : -z;
  const norm = (directed + cfg.zClamp) / (2 * cfg.zClamp);
  return Math.max(0, Math.min(1, norm));
}
