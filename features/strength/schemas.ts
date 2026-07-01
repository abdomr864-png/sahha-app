import { z } from 'zod';
import { LIFT_IDS } from './config/lifts';
import { STRENGTH_LEVELS } from './config/levels';

/**
 * Zod schemas for the persisted rows. `z.coerce.number()` mirrors the streaks /
 * progression repositories: Postgres `numeric` columns arrive as strings over
 * the wire and must be coerced before use.
 */

export const liftIdSchema = z.enum(LIFT_IDS);
export const strengthLevelSchema = z.enum(STRENGTH_LEVELS);

export const strengthEstimateRow = z.object({
  user_id: z.string().uuid(),
  lift_id: liftIdSchema,
  exercise_id: z.string().uuid().nullable(),
  est_one_rm_kg: z.coerce.number(),
  best_weight_kg: z.coerce.number(),
  best_reps: z.coerce.number().int(),
  level: strengthLevelSchema.nullable(),
  bodyweight_ratio: z.coerce.number().nullable(),
  bodyweight_kg: z.coerce.number().nullable(),
  computed_at: z.string(),
});

export type StrengthEstimateRow = z.infer<typeof strengthEstimateRow>;

export const userBadgeRow = z.object({
  user_id: z.string().uuid(),
  badge_id: z.string(),
  earned_at: z.string(),
  meta: z.unknown().nullable(),
});

export type UserBadgeRow = z.infer<typeof userBadgeRow>;
