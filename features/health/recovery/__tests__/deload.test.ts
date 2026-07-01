import { recommendDeload, consecutiveSuppressedDays } from '../deload';
import { RECOVERY_CONFIG } from '../config';

const { suppressedScore, consecutiveDays } = RECOVERY_CONFIG.deload;
const { deloadThreshold } = RECOVERY_CONFIG.acwr;

describe('consecutiveSuppressedDays', () => {
  it('counts a trailing run of suppressed days (most-recent-last)', () => {
    const scores = [80, 70, suppressedScore - 5, suppressedScore - 1, suppressedScore];
    expect(consecutiveSuppressedDays(scores)).toBe(3);
  });

  it('stops at the first non-suppressed day', () => {
    const scores = [suppressedScore, 90, suppressedScore, suppressedScore];
    expect(consecutiveSuppressedDays(scores)).toBe(2);
  });

  it('treats a null (unscored) day as breaking the streak', () => {
    const scores = [suppressedScore - 1, null, suppressedScore - 1, suppressedScore - 1];
    expect(consecutiveSuppressedDays(scores)).toBe(2);
  });

  it('is 0 when today is not suppressed', () => {
    expect(consecutiveSuppressedDays([10, 10, 90])).toBe(0);
  });
});

describe('recommendDeload', () => {
  it('recommends on an ACWR in the danger zone, regardless of scores', () => {
    const rec = recommendDeload(deloadThreshold + 0.1, [90, 90, 90]);
    expect(rec.recommend).toBe(true);
    expect(rec.reason).toBe('acwr');
    expect(rec.acwr).toBeCloseTo(deloadThreshold + 0.1, 6);
  });

  it('recommends after N consecutive suppressed days', () => {
    const suppressed = Array.from({ length: consecutiveDays }, () => suppressedScore - 1);
    const rec = recommendDeload(1.0, suppressed);
    expect(rec.recommend).toBe(true);
    expect(rec.reason).toBe('suppressed');
    expect(rec.suppressedDays).toBe(consecutiveDays);
  });

  it('prefers the ACWR reason when both conditions hold', () => {
    const suppressed = Array.from({ length: consecutiveDays }, () => suppressedScore - 1);
    const rec = recommendDeload(deloadThreshold + 0.2, suppressed);
    expect(rec.reason).toBe('acwr');
  });

  it('does not recommend in normal conditions', () => {
    const rec = recommendDeload(1.0, [80, 75, 90]);
    expect(rec.recommend).toBe(false);
    expect(rec.reason).toBeNull();
  });

  it('handles a null ACWR (no training history) via the suppression path', () => {
    const suppressed = Array.from({ length: consecutiveDays }, () => suppressedScore - 1);
    expect(recommendDeload(null, suppressed).reason).toBe('suppressed');
    expect(recommendDeload(null, [80, 80]).recommend).toBe(false);
  });
});
