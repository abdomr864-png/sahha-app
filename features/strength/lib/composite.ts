import { scoreToLevel } from './classify';
import { MAX_LEVEL_INDEX, type StrengthLevel } from '../config/levels';

export interface CompositeInput {
  /** Relative weight of this lift (LiftConfig.compositeWeight). */
  weight: number;
  /** Continuous 0–4 score for the lift (see liftScore). */
  score: number;
}

export interface CompositeResult {
  /** Weighted 0–4 score across the counted lifts. */
  score: number;
  /** 0–100 headline percentage (`score / 4 × 100`). */
  scorePct: number;
  level: StrengthLevel;
  /** How many lifts contributed (0 → no data yet). */
  liftsCounted: number;
}

const EMPTY: CompositeResult = {
  score: 0,
  scorePct: 0,
  level: 'beginner',
  liftsCounted: 0,
};

/**
 * Overall strength as a weight-averaged score of the per-lift 0–4 scores. Only
 * lifts with data contribute, so a user who has only benched is still scored on
 * what they've logged rather than being dragged down by un-logged lifts.
 */
export function compositeScore(items: readonly CompositeInput[]): CompositeResult {
  if (items.length === 0) return EMPTY;

  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0) return EMPTY;

  const weighted = items.reduce((sum, i) => sum + i.score * i.weight, 0);
  const score = weighted / totalWeight;

  return {
    score,
    scorePct: Math.round((score / MAX_LEVEL_INDEX) * 100),
    level: scoreToLevel(score),
    liftsCounted: items.length,
  };
}
