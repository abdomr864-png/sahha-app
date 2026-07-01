/**
 * Types for the readiness engine (Feature 1). The engine is a pure function of
 * the EXISTING recovery system's output (score + band + ACWR) plus yesterday's
 * load, rest history, and an optional subjective check-in. It never recomputes
 * recovery — it only consumes it.
 */
import type { RecoveryBand } from '@features/health';

/** The one-word verdict for "what should I do today?". */
export type ReadinessState = 'primed' | 'ready' | 'caution' | 'rest';

/** Optional 1–5 self-report that nudges the verdict. */
export interface SubjectiveCheckin {
  /** 1 (drained) … 5 (energized). */
  energy: number;
  /** 1 (fresh) … 5 (very sore). */
  soreness: number;
}

/** Everything the engine needs to decide. All sourced from existing systems. */
export interface ReadinessInputs {
  /** Daily recovery score 0–100, or null while the baseline is still building. */
  recoveryScore: number | null;
  /** Recovery band from the recovery system, or null while building. */
  recoveryBand: RecoveryBand | null;
  /** Acute:chronic workload ratio, or null with insufficient training history. */
  acwr: number | null;
  /** Yesterday's training volume (kg). 0 on a rest day. */
  trainingLoadYesterday: number;
  /** Number of rest (zero-load) days in the last 7. */
  restDaysLast7: number;
  /** Optional subjective check-in for today. */
  subjective: SubjectiveCheckin | null;
}

/** The concrete adjustment the lifter should apply to today's planned session. */
export interface ReadinessAdjustment {
  /** Multiply planned working loads by this (1.0 = as planned). */
  loadMultiplier: number;
  /** Hard RPE cap for working sets, or null for no cap. */
  rpeCap: number | null;
  /** Suggest cutting accessory volume today. */
  dropAccessoryVolume: boolean;
  /** Active recovery only — skip the hard session. */
  activeRecoveryOnly: boolean;
}

/** A single input that drove the verdict, for the "why" expander. */
export interface ReadinessDriver {
  key: 'acwr' | 'recovery' | 'rest' | 'subjective';
  /** Whether this driver pushed the verdict up, down, or was neutral. */
  emphasis: 'positive' | 'negative' | 'neutral';
  /** Raw value for display (e.g. the ACWR ratio, the recovery score). */
  value: number | null;
}

export interface ReadinessVerdict {
  state: ReadinessState;
  adjustment: ReadinessAdjustment;
  /** Ordered, most-important-first list of what drove the verdict. */
  drivers: ReadinessDriver[];
  /** True while the recovery baseline isn't ready — verdict is best-effort. */
  building: boolean;
}
