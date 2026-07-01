import { buildBaseline, zScore, zToSignal } from '../baseline';
import { RECOVERY_CONFIG } from '../config';

describe('buildBaseline', () => {
  it('returns null below the minimum history bar', () => {
    const short = Array.from({ length: RECOVERY_CONFIG.minHistoryDays - 1 }, () => 50);
    expect(buildBaseline(short)).toBeNull();
  });

  it('computes mean and sample SD once enough history exists', () => {
    // 7 values, mean 50, sample variance = sum((x-50)^2)/(n-1).
    const values = [47, 48, 49, 50, 51, 52, 53];
    const b = buildBaseline(values)!;
    expect(b).not.toBeNull();
    expect(b.n).toBe(7);
    expect(b.mean).toBeCloseTo(50, 6);
    // variance = (9+4+1+0+1+4+9)/6 = 28/6, sd = sqrt(4.6667) ≈ 2.1602
    expect(b.sd).toBeCloseTo(Math.sqrt(28 / 6), 6);
  });

  it('ignores non-finite values when counting history', () => {
    const values = [50, NaN, 51, Infinity, 49, 50, 50, 50, 50];
    const b = buildBaseline(values)!;
    expect(b.n).toBe(7);
  });

  it('reports zero SD for a flat series', () => {
    const b = buildBaseline([60, 60, 60, 60, 60, 60, 60])!;
    expect(b.sd).toBe(0);
    expect(b.mean).toBe(60);
  });
});

describe('zScore', () => {
  const baseline = { mean: 50, sd: 5, n: 14 };

  it('is positive above the mean, negative below', () => {
    expect(zScore(55, baseline)).toBeCloseTo(1, 6);
    expect(zScore(45, baseline)).toBeCloseTo(-1, 6);
    expect(zScore(50, baseline)).toBe(0);
  });

  it('clamps to ±zClamp', () => {
    expect(zScore(1000, baseline)).toBe(RECOVERY_CONFIG.zClamp);
    expect(zScore(-1000, baseline)).toBe(-RECOVERY_CONFIG.zClamp);
  });

  it('returns 0 when the baseline has no spread (avoids divide-by-zero)', () => {
    expect(zScore(80, { mean: 50, sd: 0, n: 14 })).toBe(0);
  });
});

describe('zToSignal', () => {
  it('maps the mean to 0.5', () => {
    expect(zToSignal(0, true)).toBeCloseTo(0.5, 6);
    expect(zToSignal(0, false)).toBeCloseTo(0.5, 6);
  });

  it('higher-is-better: +clamp → 1, -clamp → 0', () => {
    expect(zToSignal(RECOVERY_CONFIG.zClamp, true)).toBeCloseTo(1, 6);
    expect(zToSignal(-RECOVERY_CONFIG.zClamp, true)).toBeCloseTo(0, 6);
  });

  it('lower-is-better inverts the direction (used for resting HR)', () => {
    // A z above baseline (e.g. elevated RHR) should score LOW when lower-is-better.
    expect(zToSignal(RECOVERY_CONFIG.zClamp, false)).toBeCloseTo(0, 6);
    expect(zToSignal(-RECOVERY_CONFIG.zClamp, false)).toBeCloseTo(1, 6);
  });
});
