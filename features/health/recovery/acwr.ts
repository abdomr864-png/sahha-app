/**
 * Acute:chronic workload ratio (ACWR) — a simple, well-established proxy for
 * training-load risk. Acute = mean daily load over the last `acuteDays`;
 * chronic = mean daily load over the last `chronicDays`. A ratio that spikes
 * (load ramped up faster than the body adapted) is the classic injury/overreach
 * signal and, here, a deload trigger.
 *
 * Pure: callers pass an array of per-day loads (e.g. summed workout volume in
 * kg), most-recent-LAST, already bucketed to one entry per calendar day with
 * 0 for rest days. No I/O.
 */
import { RECOVERY_CONFIG, type RecoveryConfig } from './config';
import type { AcwrResult } from './types';

function meanOfLast(values: readonly number[], days: number): number {
  if (days <= 0) return 0;
  const window = values.slice(-days);
  // Always divide by the full window length (rest days count as 0 load), so the
  // ratio reflects true daily averages, not just "days trained".
  let sum = 0;
  for (const v of window) sum += Number.isFinite(v) ? v : 0;
  return sum / days;
}

/**
 * Compute ACWR from a most-recent-last series of daily loads. Returns
 * `ratio: null` when there isn't enough chronic history (fewer than
 * `acuteDays` of data) or chronic load is 0 (no training at all) — both cases
 * where a ratio would be meaningless or divide-by-zero.
 */
export function computeAcwr(
  dailyLoads: readonly number[],
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): AcwrResult {
  const acute = meanOfLast(dailyLoads, cfg.acwr.acuteDays);
  const chronic = meanOfLast(dailyLoads, cfg.acwr.chronicDays);
  const hasEnough = dailyLoads.length >= cfg.acwr.acuteDays && chronic > 0;
  return {
    acute,
    chronic,
    ratio: hasEnough ? acute / chronic : null,
  };
}

/**
 * Map an ACWR to a 0..1 training-load signal for the recovery score (higher =
 * better recovery / safer load). At/below the sweet-spot high it's full marks;
 * it ramps linearly down to 0 at the penalty ceiling. A null ratio (unknown
 * load) returns null so the caller can drop the signal and re-normalize.
 */
export function acwrToSignal(
  ratio: number | null,
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): number | null {
  if (ratio == null) return null;
  const { sweetSpotHigh, penaltyCeiling } = cfg.acwr;
  if (ratio <= sweetSpotHigh) return 1;
  if (ratio >= penaltyCeiling) return 0;
  return 1 - (ratio - sweetSpotHigh) / (penaltyCeiling - sweetSpotHigh);
}
