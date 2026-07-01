/**
 * Composite recovery / readiness score (0-100) and its band.
 *
 * Each signal is a 0..1 number where higher = better recovery:
 *   - HRV       : today vs personal baseline (higher HRV → better). Most weight.
 *   - resting HR: today vs personal baseline (LOWER RHR → better). Inverted z.
 *   - sleep     : last night vs the user's personal sleep goal.
 *   - load      : acute:chronic workload ratio (spiking load → worse).
 *
 * Signals that aren't available (no wearable, not enough history, no training
 * history) are dropped and the remaining weights re-normalized, so the score
 * degrades gracefully instead of cratering. With no wearable at all the score
 * is effectively sleep + training load only.
 */
import { zScore, zToSignal } from './baseline';
import { acwrToSignal } from './acwr';
import { RECOVERY_CONFIG, type RecoveryConfig } from './config';
import type {
  RecoveryBand,
  RecoveryBaselines,
  RecoveryFactor,
  RecoveryInputs,
  RecoveryScore,
} from './types';

function bandFor(score: number, cfg: RecoveryConfig): RecoveryBand {
  if (score >= cfg.bands.recovered) return 'recovered';
  if (score >= cfg.bands.moderate) return 'moderate';
  return 'fatigued';
}

/**
 * Build the four candidate factors. Each is marked `available` or not; the
 * caller weights only the available ones. Kept separate from the weighting so
 * the per-signal math is trivially unit-testable.
 */
export function computeFactors(
  inputs: RecoveryInputs,
  baselines: RecoveryBaselines,
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): RecoveryFactor[] {
  const factors: RecoveryFactor[] = [];

  // HRV — only when today's variant matches the baseline's variant (never mix
  // SDNN and RMSSD). Higher than baseline is better.
  if (
    inputs.hrv != null &&
    inputs.hrvVariant != null &&
    baselines.hrv != null &&
    baselines.hrv.variant === inputs.hrvVariant
  ) {
    const z = zScore(inputs.hrv, baselines.hrv, cfg);
    factors.push({
      key: 'hrv',
      signal: zToSignal(z, true, cfg),
      weight: cfg.weights.hrv,
      deltaLabel: z > 0.1 ? 'above' : z < -0.1 ? 'below' : 'at',
      available: true,
    });
  } else {
    factors.push({ key: 'hrv', signal: 0, weight: 0, deltaLabel: 'na', available: false });
  }

  // Resting HR — lower than baseline is better (inverted).
  if (inputs.restingHr != null && baselines.restingHr != null) {
    const z = zScore(inputs.restingHr, baselines.restingHr, cfg);
    factors.push({
      key: 'restingHr',
      signal: zToSignal(z, false, cfg),
      // For display: a RHR *below* baseline is the good case.
      weight: cfg.weights.restingHr,
      deltaLabel: z > 0.1 ? 'above' : z < -0.1 ? 'below' : 'at',
      available: true,
    });
  } else {
    factors.push({ key: 'restingHr', signal: 0, weight: 0, deltaLabel: 'na', available: false });
  }

  // Sleep — vs the user's personal goal (not a baseline).
  if (inputs.sleepMinutes != null && inputs.sleepGoalMin > 0) {
    const ratio = inputs.sleepMinutes / inputs.sleepGoalMin;
    factors.push({
      key: 'sleep',
      signal: Math.max(0, Math.min(1, ratio)),
      weight: cfg.weights.sleep,
      deltaLabel: ratio >= 0.98 ? (ratio > 1.02 ? 'above' : 'at') : 'below',
      available: true,
    });
  } else {
    factors.push({ key: 'sleep', signal: 0, weight: 0, deltaLabel: 'na', available: false });
  }

  // Training load — ACWR. Spiking load lowers the signal.
  const loadSignal = acwrToSignal(inputs.acwr, cfg);
  if (loadSignal != null) {
    factors.push({
      key: 'load',
      signal: loadSignal,
      weight: cfg.weights.load,
      deltaLabel: loadSignal >= 0.99 ? 'at' : 'above',
      available: true,
    });
  } else {
    factors.push({ key: 'load', signal: 0, weight: 0, deltaLabel: 'na', available: false });
  }

  return factors;
}

/**
 * Full score from inputs + baselines. Returns `building: true` (and a null
 * score) when the wearable baseline is still warming up, or when no signal at
 * all is available to score.
 */
export function computeRecoveryScore(
  inputs: RecoveryInputs,
  baselines: RecoveryBaselines,
  cfg: RecoveryConfig = RECOVERY_CONFIG,
): RecoveryScore {
  const factors = computeFactors(inputs, baselines, cfg);
  const available = factors.filter((f) => f.available);
  const totalWeight = available.reduce((acc, f) => acc + f.weight, 0);

  // Warming up: wearable history exists but hasn't hit the minimum yet.
  const warmingUp = baselines.partial && !baselines.ready;
  if (warmingUp || available.length === 0 || totalWeight <= 0) {
    return { score: null, band: null, factors, building: true };
  }

  const weighted = available.reduce((acc, f) => acc + f.signal * f.weight, 0) / totalWeight;
  const score = Math.round(Math.max(0, Math.min(100, weighted * 100)));
  return { score, band: bandFor(score, cfg), factors, building: false };
}
