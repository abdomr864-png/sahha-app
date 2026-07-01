import { computeReadiness } from '../engine';
import { READINESS_CONFIG, STATE_ADJUSTMENTS } from '../config';
import type { ReadinessInputs } from '../types';

/** A neutral, "train as planned" baseline; override per test. */
function baseInputs(over: Partial<ReadinessInputs> = {}): ReadinessInputs {
  return {
    recoveryScore: 55,
    recoveryBand: 'moderate',
    acwr: 1.0,
    trainingLoadYesterday: 5000,
    restDaysLast7: 2,
    subjective: null,
    ...over,
  };
}

describe('computeReadiness — verdict', () => {
  it('primed: top band + healthy ACWR, no RPE cap and a small bump', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'recovered', recoveryScore: 80, acwr: 1.0 }),
    );
    expect(v.state).toBe('primed');
    expect(v.adjustment.loadMultiplier).toBeGreaterThan(1);
    expect(v.adjustment.rpeCap).toBeNull();
  });

  it('ready: mid band trains as planned', () => {
    const v = computeReadiness(baseInputs({ recoveryBand: 'moderate' }));
    expect(v.state).toBe('ready');
    expect(v.adjustment.loadMultiplier).toBe(1);
  });

  it('caution: low band pulls back with an RPE cap', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'fatigued', recoveryScore: 30, restDaysLast7: 2 }),
    );
    expect(v.state).toBe('caution');
    expect(v.adjustment.loadMultiplier).toBe(0.8);
    expect(v.adjustment.rpeCap).toBe(7);
    expect(v.adjustment.dropAccessoryVolume).toBe(true);
  });

  it('overreaching: ACWR > 1.5 caps to caution even with a great recovery score', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'recovered', recoveryScore: 90, acwr: 1.7 }),
    );
    expect(v.state).toBe('caution');
  });

  it('overreaching + fatigued → rest', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'fatigued', recoveryScore: 25, acwr: 1.8 }),
    );
    expect(v.state).toBe('rest');
    expect(v.adjustment.activeRecoveryOnly).toBe(true);
  });

  it('rest: zero rest days in 7 + fatigued → rest', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'fatigued', recoveryScore: 30, restDaysLast7: 0, acwr: 1.1 }),
    );
    expect(v.state).toBe('rest');
  });

  it('recovered but ACWR unconfirmed (null) does not grant primed', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'recovered', recoveryScore: 85, acwr: null }),
    );
    expect(v.state).toBe('ready');
  });

  it('recovered but detraining (ACWR < 0.8) does not grant primed', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'recovered', recoveryScore: 85, acwr: 0.5 }),
    );
    expect(v.state).toBe('ready');
  });
});

describe('computeReadiness — subjective check-in', () => {
  it('drained (low energy + high soreness) downgrades one notch', () => {
    const { lowBoth, highSoreness } = READINESS_CONFIG.subjective;
    const v = computeReadiness(
      baseInputs({
        recoveryBand: 'moderate',
        subjective: { energy: lowBoth, soreness: highSoreness },
      }),
    );
    expect(v.state).toBe('caution'); // ready → caution
    expect(v.drivers.some((d) => d.key === 'subjective')).toBe(true);
  });

  it('high soreness alone only blocks the green light (primed → ready)', () => {
    const v = computeReadiness(
      baseInputs({
        recoveryBand: 'recovered',
        recoveryScore: 82,
        acwr: 1.0,
        subjective: { energy: 5, soreness: 5 },
      }),
    );
    expect(v.state).toBe('ready');
  });

  it('good subjective check-in leaves the verdict untouched', () => {
    const v = computeReadiness(
      baseInputs({
        recoveryBand: 'recovered',
        recoveryScore: 82,
        acwr: 1.0,
        subjective: { energy: 5, soreness: 1 },
      }),
    );
    expect(v.state).toBe('primed');
  });
});

describe('computeReadiness — building + drivers', () => {
  it('flags building when the recovery score is null but still returns a verdict', () => {
    const v = computeReadiness(baseInputs({ recoveryScore: null, recoveryBand: null, acwr: 1.0 }));
    expect(v.building).toBe(true);
    expect(v.state).toBe('ready');
  });

  it('overreaching while building still caps to caution', () => {
    const v = computeReadiness(baseInputs({ recoveryScore: null, recoveryBand: null, acwr: 1.9 }));
    expect(v.state).toBe('caution');
  });

  it('exposes the ACWR and recovery drivers with sensible emphasis', () => {
    const v = computeReadiness(
      baseInputs({ recoveryBand: 'recovered', recoveryScore: 80, acwr: 1.0 }),
    );
    const acwr = v.drivers.find((d) => d.key === 'acwr');
    const rec = v.drivers.find((d) => d.key === 'recovery');
    expect(acwr?.emphasis).toBe('positive');
    expect(rec?.emphasis).toBe('positive');
  });
});

describe('STATE_ADJUSTMENTS invariants', () => {
  it('every state has a non-negative multiplier and only rest is active-recovery', () => {
    for (const [state, adj] of Object.entries(STATE_ADJUSTMENTS)) {
      expect(adj.loadMultiplier).toBeGreaterThanOrEqual(0);
      expect(adj.activeRecoveryOnly).toBe(state === 'rest');
    }
  });
});
