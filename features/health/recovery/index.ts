/**
 * Pure recovery / readiness math. No React, no I/O — safe to import from hooks,
 * tests, or a future server function. The hooks live in ../hooks.
 */
export { RECOVERY_CONFIG } from './config';
export type { RecoveryConfig } from './config';
export { buildBaseline, zScore, zToSignal } from './baseline';
export { computeAcwr, acwrToSignal } from './acwr';
export { computeFactors, computeRecoveryScore } from './score';
export { recommendDeload, consecutiveSuppressedDays } from './deload';
export type {
  Baseline,
  HrvVariant,
  RecoveryBand,
  RecoveryBaselines,
  RecoveryFactor,
  RecoveryInputs,
  RecoveryScore,
  AcwrResult,
  DeloadReason,
  DeloadRecommendation,
} from './types';
