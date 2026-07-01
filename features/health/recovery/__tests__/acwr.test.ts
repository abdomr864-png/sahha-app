import { computeAcwr, acwrToSignal } from '../acwr';
import { RECOVERY_CONFIG } from '../config';

const { acuteDays, chronicDays } = RECOVERY_CONFIG.acwr;

describe('computeAcwr', () => {
  it('returns null ratio without enough history for the acute window', () => {
    const loads = [100, 100, 100]; // fewer than acuteDays
    const res = computeAcwr(loads);
    expect(res.ratio).toBeNull();
  });

  it('returns null ratio when chronic load is zero (no training at all)', () => {
    const loads = Array.from({ length: chronicDays }, () => 0);
    expect(computeAcwr(loads).ratio).toBeNull();
  });

  it('is ~1 for a steady, unchanging load', () => {
    const loads = Array.from({ length: chronicDays }, () => 500);
    const res = computeAcwr(loads);
    expect(res.acute).toBeCloseTo(500, 6);
    expect(res.chronic).toBeCloseTo(500, 6);
    expect(res.ratio).toBeCloseTo(1, 6);
  });

  it('spikes above 1 when recent load jumps', () => {
    // 28 days: first 21 at 100, last 7 at 300.
    const loads = [
      ...Array.from({ length: chronicDays - acuteDays }, () => 100),
      ...Array.from({ length: acuteDays }, () => 300),
    ];
    const res = computeAcwr(loads);
    expect(res.acute).toBeCloseTo(300, 6);
    // chronic mean = (21*100 + 7*300) / 28 = (2100 + 2100)/28 = 150
    expect(res.chronic).toBeCloseTo(150, 6);
    expect(res.ratio).toBeCloseTo(2, 6);
  });

  it('counts rest days as zero load in the daily average', () => {
    // acute window has training only every other day.
    const loads = Array.from({ length: acuteDays }, (_, i) => (i % 2 === 0 ? 700 : 0));
    const res = computeAcwr([
      ...Array.from({ length: chronicDays - acuteDays }, () => 0),
      ...loads,
    ]);
    // 4 of 7 days at 700 → acute mean = 2800/7 = 400
    expect(res.acute).toBeCloseTo(2800 / acuteDays, 6);
  });
});

describe('acwrToSignal', () => {
  it('returns null for an unknown ratio', () => {
    expect(acwrToSignal(null)).toBeNull();
  });

  it('is full marks inside the sweet spot', () => {
    expect(acwrToSignal(1.0)).toBe(1);
    expect(acwrToSignal(RECOVERY_CONFIG.acwr.sweetSpotHigh)).toBe(1);
    expect(acwrToSignal(0.6)).toBe(1);
  });

  it('is fully penalized at/above the penalty ceiling', () => {
    expect(acwrToSignal(RECOVERY_CONFIG.acwr.penaltyCeiling)).toBe(0);
    expect(acwrToSignal(3)).toBe(0);
  });

  it('ramps linearly between sweet spot and ceiling', () => {
    const { sweetSpotHigh, penaltyCeiling } = RECOVERY_CONFIG.acwr;
    const mid = (sweetSpotHigh + penaltyCeiling) / 2;
    expect(acwrToSignal(mid)).toBeCloseTo(0.5, 6);
  });
});
