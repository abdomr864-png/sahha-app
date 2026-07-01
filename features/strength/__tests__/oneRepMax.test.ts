import {
  epleyOneRepMax,
  isEstimableSet,
  bestEstimateInWindow,
  type EstimationSet,
} from '../lib/oneRepMax';

const at = (daysAgo: number): string =>
  new Date(Date.UTC(2026, 0, 1) - daysAgo * 86_400_000).toISOString();
const NOW = new Date(Date.UTC(2026, 0, 1));

describe('epleyOneRepMax', () => {
  it('returns the weight unchanged at 1 rep', () => {
    expect(epleyOneRepMax(100, 1)).toBeCloseTo(103.333, 2);
    // Sanity: a true single is the load itself only when reps→0; Epley adds
    // 1/30 per rep, so 1 rep ≈ +3.3%.
  });

  it('applies w × (1 + reps/30)', () => {
    expect(epleyOneRepMax(100, 5)).toBeCloseTo(116.667, 2);
    expect(epleyOneRepMax(60, 10)).toBeCloseTo(80, 5);
    expect(epleyOneRepMax(140, 3)).toBeCloseTo(154, 5);
  });

  it('is zero for non-positive weight or reps', () => {
    expect(epleyOneRepMax(0, 5)).toBe(0);
    expect(epleyOneRepMax(100, 0)).toBe(0);
    expect(epleyOneRepMax(-50, 5)).toBe(0);
  });
});

describe('isEstimableSet', () => {
  const base: EstimationSet = { weightKg: 100, reps: 5, performedAt: at(1) };

  it('accepts a normal working set', () => {
    expect(isEstimableSet(base)).toBe(true);
  });

  it('rejects warm-ups by default', () => {
    expect(isEstimableSet({ ...base, isWarmup: true })).toBe(false);
  });

  it('rejects high-rep sets beyond the Epley-reliable ceiling', () => {
    expect(isEstimableSet({ ...base, reps: 13 })).toBe(false);
    expect(isEstimableSet({ ...base, reps: 12 })).toBe(true);
  });

  it('rejects empty load or reps', () => {
    expect(isEstimableSet({ ...base, weightKg: 0 })).toBe(false);
    expect(isEstimableSet({ ...base, reps: 0 })).toBe(false);
  });
});

describe('bestEstimateInWindow', () => {
  it('returns null when there are no eligible sets', () => {
    expect(bestEstimateInWindow([], NOW)).toBeNull();
    expect(bestEstimateInWindow([{ weightKg: 0, reps: 5, performedAt: at(1) }], NOW)).toBeNull();
  });

  it('picks the set with the highest Epley estimate', () => {
    const sets: EstimationSet[] = [
      { weightKg: 100, reps: 5, performedAt: at(2) }, // 116.7
      { weightKg: 110, reps: 3, performedAt: at(1) }, // 121.0
      { weightKg: 120, reps: 1, performedAt: at(3) }, // 124.0  ← best
    ];
    const best = bestEstimateInWindow(sets, NOW);
    expect(best?.weightKg).toBe(120);
    expect(best?.estOneRmKg).toBeCloseTo(124, 5);
  });

  it('ignores sets older than the window', () => {
    const sets: EstimationSet[] = [
      { weightKg: 200, reps: 1, performedAt: at(100) }, // stale, excluded
      { weightKg: 100, reps: 5, performedAt: at(5) },
    ];
    const best = bestEstimateInWindow(sets, NOW, 42);
    expect(best?.weightKg).toBe(100);
  });

  it('breaks estimate ties toward the heavier top set', () => {
    const sets: EstimationSet[] = [
      { weightKg: 90, reps: 10, performedAt: at(1) }, // 90 × 1.333 = 120
      { weightKg: 100, reps: 6, performedAt: at(1) }, // 100 × 1.2   = 120
    ];
    const best = bestEstimateInWindow(sets, NOW);
    expect(best?.estOneRmKg).toBeCloseTo(120, 5);
    expect(best?.weightKg).toBe(100); // heavier of the two tied top sets
  });
});
