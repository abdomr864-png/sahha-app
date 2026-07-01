/**
 * The readiness engine — a pure function answering "what should I do today?".
 *
 * No React, no I/O. It consumes the recovery system's already-computed score,
 * band, and ACWR (it never recomputes them) and produces a verdict + a concrete
 * training adjustment. Safe to import from hooks, tests, or a server function.
 *
 * Decision order (spec §2), highest precedence first:
 *   1. ACWR > 1.5 (overreaching)        → caution, or rest if also fatigued / no rest taken
 *   2. 0 rest days in 7 AND fatigued    → rest
 *   3. Recovery band low (fatigued)     → caution
 *   4. Recovery top band AND healthy ACWR → primed
 *   5. Recovery mid band (moderate)     → ready
 *   6. otherwise                        → ready
 * A subjective check-in (both signals low, or high soreness) can downgrade the
 * verdict one notch afterwards.
 */
import { READINESS_CONFIG, STATE_ADJUSTMENTS } from './config';
import type {
  ReadinessDriver,
  ReadinessInputs,
  ReadinessState,
  ReadinessVerdict,
  SubjectiveCheckin,
} from './types';

function acwrIsHealthy(acwr: number | null): boolean {
  if (acwr === null) return false; // not confirmed healthy → don't grant `primed`
  const { healthyLow, healthyHigh } = READINESS_CONFIG.acwr;
  return acwr >= healthyLow && acwr <= healthyHigh;
}

/** One step gentler. primed → ready → caution → rest (rest is the floor). */
function downgrade(state: ReadinessState): ReadinessState {
  const order: ReadinessState[] = ['primed', 'ready', 'caution', 'rest'];
  const i = order.indexOf(state);
  return order[Math.min(i + 1, order.length - 1)] ?? state;
}

/** Apply the optional subjective check-in as a one-notch nudge. */
function applySubjective(
  state: ReadinessState,
  subjective: SubjectiveCheckin | null,
): { state: ReadinessState; driven: boolean } {
  if (!subjective) return { state, driven: false };
  const { lowBoth, highSoreness } = READINESS_CONFIG.subjective;
  // Drained: low energy AND high soreness — the worst combination → one notch down.
  const drained = subjective.energy <= lowBoth && subjective.soreness >= highSoreness;
  if (drained) return { state: downgrade(state), driven: true };
  // High soreness alone only blocks the green light.
  if (state === 'primed' && subjective.soreness >= highSoreness) {
    return { state: 'ready', driven: true };
  }
  return { state, driven: false };
}

function baseVerdict(inputs: ReadinessInputs): ReadinessState {
  const { acwr, recoveryBand, restDaysLast7 } = inputs;
  const noRestTaken = restDaysLast7 <= 0;

  // 1. Overreaching dominates everything.
  if (acwr !== null && acwr > READINESS_CONFIG.acwr.overreaching) {
    return recoveryBand === 'fatigued' || noRestTaken ? 'rest' : 'caution';
  }
  // 2. Grinding with no rest while already fatigued.
  if (noRestTaken && recoveryBand === 'fatigued') return 'rest';
  // 3. Low recovery.
  if (recoveryBand === 'fatigued') return 'caution';
  // 4. Green light: top band + a healthy, confirmed load ratio.
  if (recoveryBand === 'recovered' && acwrIsHealthy(acwr)) return 'primed';
  // 5/6. Mid band, or recovered-but-load-unconfirmed → train as planned.
  return 'ready';
}

function buildDrivers(inputs: ReadinessInputs, subjectiveDrove: boolean): ReadinessDriver[] {
  const drivers: ReadinessDriver[] = [];
  const { acwr, recoveryScore, recoveryBand, restDaysLast7, subjective } = inputs;

  if (acwr !== null) {
    drivers.push({
      key: 'acwr',
      emphasis:
        acwr > READINESS_CONFIG.acwr.overreaching
          ? 'negative'
          : acwrIsHealthy(acwr)
            ? 'positive'
            : 'neutral',
      value: acwr,
    });
  }
  if (recoveryScore !== null) {
    drivers.push({
      key: 'recovery',
      emphasis:
        recoveryBand === 'recovered'
          ? 'positive'
          : recoveryBand === 'fatigued'
            ? 'negative'
            : 'neutral',
      value: recoveryScore,
    });
  }
  if (restDaysLast7 <= 0) {
    drivers.push({ key: 'rest', emphasis: 'negative', value: restDaysLast7 });
  }
  if (subjective && subjectiveDrove) {
    drivers.push({ key: 'subjective', emphasis: 'negative', value: subjective.energy });
  }
  return drivers;
}

/** Compute today's readiness verdict from already-computed recovery signals. */
export function computeReadiness(inputs: ReadinessInputs): ReadinessVerdict {
  const base = baseVerdict(inputs);
  const { state, driven } = applySubjective(base, inputs.subjective);
  return {
    state,
    adjustment: STATE_ADJUSTMENTS[state],
    drivers: buildDrivers(inputs, driven),
    building: inputs.recoveryScore === null,
  };
}
