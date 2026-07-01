/**
 * Smart deload recommendation. Recommend a deload when EITHER:
 *   - acute:chronic workload ratio is in the danger zone (>= deloadThreshold), OR
 *   - the recovery score has been suppressed for N consecutive days (incl. today).
 *
 * Pure: the caller supplies today's ACWR and a most-recent-LAST series of recent
 * daily recovery scores (nulls allowed for days we couldn't score). ACWR takes
 * precedence as the reason because it's the more actionable, load-based signal.
 */
import { RECOVERY_CONFIG, type RecoveryConfig } from './config';
import type { DeloadRecommendation } from './types';

/**
 * Count consecutive suppressed days ending at today (the last element).
 * A null score breaks the streak (unknown day ≠ suppressed day).
 */
export function consecutiveSuppressedDays(
  recentScores: readonly (number | null)[],
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): number {
  let count = 0;
  for (let i = recentScores.length - 1; i >= 0; i--) {
    const s = recentScores[i];
    if (s != null && s <= cfg.deload.suppressedScore) count++;
    else break;
  }
  return count;
}

export function recommendDeload(
  acwr: number | null,
  recentScores: readonly (number | null)[],
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): DeloadRecommendation {
  const suppressedDays = consecutiveSuppressedDays(recentScores, cfg);

  if (acwr != null && acwr >= cfg.acwr.deloadThreshold) {
    return { recommend: true, reason: 'acwr', acwr, suppressedDays };
  }
  if (suppressedDays >= cfg.deload.consecutiveDays) {
    return { recommend: true, reason: 'suppressed', acwr: null, suppressedDays };
  }
  return { recommend: false, reason: null, acwr: null, suppressedDays };
}
