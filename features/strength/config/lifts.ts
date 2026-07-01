import type { IconName } from '@features/shared';

/**
 * The main barbell lifts we classify. The id is the stable key persisted in
 * `user_strength_estimates.lift_id` and used across config/badges/i18n — never
 * rename one without a data migration.
 */
export const LIFT_IDS = ['squat', 'bench', 'deadlift', 'overhead_press', 'barbell_row'] as const;

export type LiftId = (typeof LIFT_IDS)[number];

export interface LiftConfig {
  id: LiftId;
  /** i18n key under `strength.lifts.<id>` for the display name. */
  icon: IconName;
  /**
   * Exact `exercises.name_en` values (from the seed migrations) that map to
   * this canonical lift. The first entry is the canonical/primary variant.
   */
  exerciseNames: readonly string[];
  /**
   * Lowercase substrings used as a fallback matcher for custom/renamed
   * exercises when an exact name match fails. Kept deliberately specific to
   * avoid e.g. "leg press" matching "bench press".
   */
  nameMatchers: readonly string[];
  /**
   * Relative weight in the composite strength score. The big-three carry more
   * signal about overall strength than the accessory presses/rows.
   */
  compositeWeight: number;
}

export const LIFTS: Record<LiftId, LiftConfig> = {
  squat: {
    id: 'squat',
    icon: 'dumbbell',
    exerciseNames: ['Back Squat', 'Front Squat'],
    nameMatchers: ['back squat', 'barbell squat', 'high bar', 'low bar'],
    compositeWeight: 1.2,
  },
  bench: {
    id: 'bench',
    icon: 'dumbbell',
    exerciseNames: ['Barbell Bench Press', 'Incline Barbell Bench Press'],
    nameMatchers: ['bench press', 'barbell bench'],
    compositeWeight: 1.0,
  },
  deadlift: {
    id: 'deadlift',
    icon: 'dumbbell',
    exerciseNames: ['Conventional Deadlift', 'Sumo Deadlift', 'Trap Bar Deadlift'],
    nameMatchers: ['deadlift'],
    compositeWeight: 1.2,
  },
  overhead_press: {
    id: 'overhead_press',
    icon: 'dumbbell',
    exerciseNames: ['Overhead Press'],
    nameMatchers: ['overhead press', 'military press', 'shoulder press', 'ohp'],
    compositeWeight: 0.8,
  },
  barbell_row: {
    id: 'barbell_row',
    icon: 'dumbbell',
    exerciseNames: ['Barbell Row', 'Pendlay Row'],
    nameMatchers: ['barbell row', 'bent over row', 'bent-over row', 'pendlay'],
    compositeWeight: 0.8,
  },
};

export const LIFT_LIST: readonly LiftConfig[] = LIFT_IDS.map((id) => LIFTS[id]);

/**
 * Tunable estimation parameters. Kept here (typed) rather than scattered as
 * magic numbers so the recompute window and rep ceiling are easy to adjust.
 */
export const STRENGTH_CONFIG = {
  /** Recent window the best-estimate is taken over (task: 4–6 weeks). */
  windowDays: 42,
  /**
   * Epley degrades badly past ~12 reps, so sets above this are ignored for 1RM
   * estimation (they still count as logged volume elsewhere in the app).
   */
  maxRepsForEstimate: 12,
  /** Warm-up sets are excluded; only working sets inform the estimate. */
  includeWarmups: false,
} as const;
