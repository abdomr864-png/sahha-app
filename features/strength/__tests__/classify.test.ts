import {
  classifyLift,
  progressToNextLevel,
  resolveThresholds,
  toClassifiableSex,
  liftScore,
  scoreToLevel,
} from '../lib/classify';
import { compositeScore } from '../lib/composite';
import { standardsFor } from '../config/standards';

describe('toClassifiableSex', () => {
  it('passes through male/female and rejects other/null', () => {
    expect(toClassifiableSex('male')).toBe('male');
    expect(toClassifiableSex('female')).toBe('female');
    expect(toClassifiableSex('other')).toBeNull();
    expect(toClassifiableSex(null)).toBeNull();
    expect(toClassifiableSex(undefined)).toBeNull();
  });
});

describe('classifyLift (male bench, published multiples)', () => {
  const bw = 90; // matches REFERENCE_BODYWEIGHT_KG.male
  const std = standardsFor('male', 'bench'); // novice .75 / int 1.0 / adv 1.5 / elite 2.0

  it('classifies below novice as beginner', () => {
    const r = classifyLift(0.5 * bw, bw, 'male', 'bench');
    expect(r?.level).toBe('beginner');
  });

  it('classifies exactly at a threshold as that level (inclusive)', () => {
    expect(classifyLift(std.novice * bw, bw, 'male', 'bench')?.level).toBe('novice');
    expect(classifyLift(std.intermediate * bw, bw, 'male', 'bench')?.level).toBe('intermediate');
    expect(classifyLift(std.advanced * bw, bw, 'male', 'bench')?.level).toBe('advanced');
    expect(classifyLift(std.elite * bw, bw, 'male', 'bench')?.level).toBe('elite');
  });

  it('caps at elite beyond the top threshold', () => {
    const r = classifyLift(3 * bw, bw, 'male', 'bench');
    expect(r?.level).toBe('elite');
    expect(r?.ratio).toBeCloseTo(3, 5);
  });

  it('returns null without a bodyweight', () => {
    expect(classifyLift(100, 0, 'male', 'bench')).toBeNull();
    expect(classifyLift(100, -1, 'male', 'bench')).toBeNull();
  });
});

describe('resolveThresholds', () => {
  it('exposes a beginner floor at 0 and matches the standards table', () => {
    const t = resolveThresholds('male', 'squat', 90);
    const std = standardsFor('male', 'squat');
    expect(t.beginner).toBe(0);
    expect(t.novice).toBeCloseTo(std.novice, 5);
    expect(t.elite).toBeCloseTo(std.elite, 5);
  });
});

describe('progressToNextLevel', () => {
  const bw = 90;

  it('reports remaining kg to the next tier and a 0–1 fraction', () => {
    // Male bench intermediate entry = 1.0×bw = 90kg; advanced entry = 1.5×bw = 135kg.
    const est = 112.5; // exactly halfway between 90 and 135
    const cls = classifyLift(est, bw, 'male', 'bench')!;
    expect(cls.level).toBe('intermediate');
    const p = progressToNextLevel(est, bw, cls);
    expect(p.next).toBe('advanced');
    expect(p.fraction).toBeCloseTo(0.5, 5);
    expect(p.nextTargetKg).toBeCloseTo(135, 5);
    expect(p.remainingKg).toBeCloseTo(22.5, 5);
  });

  it('clamps a freshly-promoted lift near 0 and reports full progress at elite', () => {
    const noviceEntry = standardsFor('male', 'bench').novice * bw; // 67.5
    const clsNovice = classifyLift(noviceEntry, bw, 'male', 'bench')!;
    expect(progressToNextLevel(noviceEntry, bw, clsNovice).fraction).toBeCloseTo(0, 5);

    const eliteEst = 5 * bw;
    const clsElite = classifyLift(eliteEst, bw, 'male', 'bench')!;
    const pElite = progressToNextLevel(eliteEst, bw, clsElite);
    expect(pElite.next).toBeNull();
    expect(pElite.remainingKg).toBeNull();
    expect(pElite.fraction).toBe(1);
  });
});

describe('liftScore / scoreToLevel / compositeScore', () => {
  const bw = 90;

  it('produces a continuous 0–4 score that snaps back to the floor level', () => {
    const est = 112.5; // mid-intermediate (index 2, +0.5)
    const cls = classifyLift(est, bw, 'male', 'bench')!;
    const p = progressToNextLevel(est, bw, cls);
    const score = liftScore(cls, p);
    expect(score).toBeCloseTo(2.5, 5);
    expect(scoreToLevel(score)).toBe('intermediate');
  });

  it('weight-averages only the lifts that have data', () => {
    const result = compositeScore([
      { weight: 1.0, score: 2 }, // intermediate bench
      { weight: 1.2, score: 1 }, // novice squat
    ]);
    // (2×1.0 + 1×1.2) / (1.0 + 1.2) = 3.2 / 2.2 ≈ 1.4545
    expect(result.score).toBeCloseTo(1.4545, 3);
    expect(result.level).toBe('novice');
    expect(result.liftsCounted).toBe(2);
    expect(result.scorePct).toBe(Math.round((result.score / 4) * 100));
  });

  it('returns an empty/beginner composite with no data', () => {
    const empty = compositeScore([]);
    expect(empty.liftsCounted).toBe(0);
    expect(empty.level).toBe('beginner');
    expect(empty.scorePct).toBe(0);
  });
});
