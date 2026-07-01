/**
 * Tunable thresholds + per-state adjustments for the readiness engine. Kept
 * separate from the pure logic (engine.ts) so the decision stays data-driven.
 * ACWR cutoffs intentionally reuse the recovery system's config so the two
 * systems never disagree about what "overreaching" means.
 */
// Import from the PURE recovery submodule (no React, no I/O) rather than the
// @features/health barrel, which transitively loads the Supabase client. Keeps
// the engine importable from tests and a future server function.
import { RECOVERY_CONFIG } from '@features/health/recovery';
import type { ReadinessAdjustment, ReadinessState } from './types';

export const READINESS_CONFIG = {
  acwr: {
    /** Above this → overreaching (caution/rest regardless of recovery). */
    overreaching: RECOVERY_CONFIG.acwr.deloadThreshold, // 1.5
    /** Healthy "sweet spot" window — required (with a top band) for `primed`. */
    healthyLow: 0.8,
    healthyHigh: RECOVERY_CONFIG.acwr.sweetSpotHigh, // 1.3
  },
  subjective: {
    /** energy AND soreness both ≤ this downgrades the verdict one notch. */
    lowBoth: 2,
    /** soreness ≥ this alone caps `primed` down to `ready`. */
    highSoreness: 4,
  },
} as const;

/** The concrete training adjustment for each verdict (spec §2). */
export const STATE_ADJUSTMENTS: Record<ReadinessState, ReadinessAdjustment> = {
  // Top band + healthy load: a small green light, no RPE cap.
  primed: {
    loadMultiplier: 1.05,
    rpeCap: null,
    dropAccessoryVolume: false,
    activeRecoveryOnly: false,
  },
  // Train as planned.
  ready: {
    loadMultiplier: 1.0,
    rpeCap: null,
    dropAccessoryVolume: false,
    activeRecoveryOnly: false,
  },
  // Pull back: lighter loads, capped intensity, trim accessories.
  caution: {
    loadMultiplier: 0.8,
    rpeCap: 7,
    dropAccessoryVolume: true,
    activeRecoveryOnly: false,
  },
  // Active recovery only.
  rest: {
    loadMultiplier: 0.5,
    rpeCap: 5,
    dropAccessoryVolume: true,
    activeRecoveryOnly: true,
  },
};
