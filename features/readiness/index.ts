/**
 * Readiness engine (Feature 1) — the flagship "what should I do today?" verdict.
 * Consumes the existing recovery system; never recomputes it.
 */
export { computeReadiness } from './engine';
export { READINESS_CONFIG, STATE_ADJUSTMENTS } from './config';
export { useReadiness } from './hooks/useReadiness';
export type { UseReadinessResult } from './hooks/useReadiness';
export { useCheckinStore } from './store';
export { TodayCard } from './components/TodayCard';
export { localDayKey } from './date';
export type {
  ReadinessState,
  ReadinessInputs,
  ReadinessAdjustment,
  ReadinessDriver,
  ReadinessVerdict,
  SubjectiveCheckin,
} from './types';
