import { computeFactors, computeRecoveryScore } from '../score';
import { RECOVERY_CONFIG } from '../config';
import type { RecoveryBaselines, RecoveryInputs } from '../types';

const baseInputs: RecoveryInputs = {
  restingHr: 50,
  hrv: 60,
  hrvVariant: 'SDNN',
  sleepMinutes: 480,
  sleepGoalMin: 480,
  acwr: 1.0,
};

const fullBaselines: RecoveryBaselines = {
  restingHr: { mean: 50, sd: 4, n: 28 },
  hrv: { mean: 60, sd: 8, n: 28, variant: 'SDNN' },
  sleep: { mean: 460, sd: 30, n: 28 },
  ready: true,
  partial: false,
};

describe('computeFactors — HRV variant safety', () => {
  it('drops HRV when today is RMSSD but the baseline is SDNN (never mixes)', () => {
    const factors = computeFactors({ ...baseInputs, hrvVariant: 'RMSSD', hrv: 42 }, fullBaselines);
    const hrv = factors.find((f) => f.key === 'hrv')!;
    expect(hrv.available).toBe(false);
    expect(hrv.weight).toBe(0);
  });

  it('uses HRV when variants match', () => {
    const factors = computeFactors(baseInputs, fullBaselines);
    expect(factors.find((f) => f.key === 'hrv')!.available).toBe(true);
  });
});

describe('computeRecoveryScore — directionality', () => {
  it('high HRV + low resting HR + full sleep → Recovered', () => {
    const res = computeRecoveryScore(
      { ...baseInputs, hrv: 80, restingHr: 42, sleepMinutes: 500 },
      fullBaselines,
    );
    expect(res.building).toBe(false);
    expect(res.score!).toBeGreaterThanOrEqual(RECOVERY_CONFIG.bands.recovered);
    expect(res.band).toBe('recovered');
  });

  it('low HRV + elevated resting HR + short sleep + load spike → Fatigued', () => {
    const res = computeRecoveryScore(
      { ...baseInputs, hrv: 40, restingHr: 62, sleepMinutes: 300, acwr: 1.9 },
      fullBaselines,
    );
    expect(res.score!).toBeLessThan(RECOVERY_CONFIG.bands.moderate);
    expect(res.band).toBe('fatigued');
  });

  it('every signal at the 0.5 midpoint lands at ~50 (Moderate)', () => {
    // HRV/RHR exactly at baseline → 0.5; sleep at half the goal → 0.5; ACWR at
    // the mid of the penalty ramp → 0.5. Weighted mean of 0.5s = 50.
    const midAcwr = (RECOVERY_CONFIG.acwr.sweetSpotHigh + RECOVERY_CONFIG.acwr.penaltyCeiling) / 2;
    const res = computeRecoveryScore(
      { ...baseInputs, hrv: 60, restingHr: 50, sleepMinutes: 240, acwr: midAcwr },
      fullBaselines,
    );
    expect(res.score).toBe(50);
    expect(res.band).toBe('moderate');
  });
});

describe('computeRecoveryScore — graceful degradation (no wearable)', () => {
  const noWearable: RecoveryBaselines = {
    restingHr: null,
    hrv: null,
    sleep: null,
    ready: false,
    partial: false, // no wearable history at all → not "building"
  };

  it('still scores from sleep + training load only', () => {
    const res = computeRecoveryScore(
      { ...baseInputs, restingHr: null, hrv: null, hrvVariant: null, sleepMinutes: 480, acwr: 1.0 },
      noWearable,
    );
    expect(res.building).toBe(false);
    expect(res.score).not.toBeNull();
    const available = res.factors
      .filter((f) => f.available)
      .map((f) => f.key)
      .sort();
    expect(available).toEqual(['load', 'sleep']);
  });

  it('a perfect sleep + safe load with no wearable scores high', () => {
    const res = computeRecoveryScore(
      { ...baseInputs, restingHr: null, hrv: null, hrvVariant: null, sleepMinutes: 480, acwr: 0.9 },
      noWearable,
    );
    expect(res.score).toBe(100);
  });
});

describe('computeRecoveryScore — building state', () => {
  it('reports building while wearable history is still accumulating', () => {
    const partial: RecoveryBaselines = {
      restingHr: null,
      hrv: null,
      sleep: null,
      ready: false,
      partial: true,
    };
    const res = computeRecoveryScore(baseInputs, partial);
    expect(res.building).toBe(true);
    expect(res.score).toBeNull();
    expect(res.band).toBeNull();
  });

  it('reports building when literally no signal is available', () => {
    const none: RecoveryBaselines = {
      restingHr: null,
      hrv: null,
      sleep: null,
      ready: false,
      partial: false,
    };
    const res = computeRecoveryScore(
      {
        restingHr: null,
        hrv: null,
        hrvVariant: null,
        sleepMinutes: null,
        sleepGoalMin: 480,
        acwr: null,
      },
      none,
    );
    expect(res.building).toBe(true);
    expect(res.score).toBeNull();
  });
});
