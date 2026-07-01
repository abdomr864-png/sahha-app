/**
 * The five strength tiers, ordered weakest → strongest. This ordering is the
 * single source of truth: indices drive progress bars, composite scoring and
 * "next level" lookups everywhere else in the feature.
 */
export const STRENGTH_LEVELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'] as const;

export type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

/** Levels above `beginner` — i.e. the ones a bodyweight ratio threshold gates. */
export type RatedLevel = Exclude<StrengthLevel, 'beginner'>;

export const RATED_LEVELS: readonly RatedLevel[] = ['novice', 'intermediate', 'advanced', 'elite'];

/** 0-based rank of a level (beginner = 0 … elite = 4). */
export function levelIndex(level: StrengthLevel): number {
  return STRENGTH_LEVELS.indexOf(level);
}

/** The next tier up, or null if already elite. */
export function nextLevel(level: StrengthLevel): StrengthLevel | null {
  const i = levelIndex(level);
  return i >= 0 && i < STRENGTH_LEVELS.length - 1
    ? (STRENGTH_LEVELS[i + 1] as StrengthLevel)
    : null;
}

export const MAX_LEVEL_INDEX = STRENGTH_LEVELS.length - 1;

/** Accent colour per level — used by cards, the composite ring and badges. */
export const LEVEL_COLOR: Record<StrengthLevel, string> = {
  beginner: '#74748A', // ink-muted
  novice: '#2EE6A6', // success / green
  intermediate: '#4DA3FF', // blue
  advanced: '#A855F7', // purple
  elite: '#FF8A2B', // accent flame
};
