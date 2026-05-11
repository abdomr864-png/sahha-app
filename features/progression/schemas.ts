import { z } from 'zod';

export const nextSessionSuggestion = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  program_exercise_id: z.string().uuid().nullable(),
  suggested_weight_kg: z.coerce.number().nullable(),
  suggested_reps: z.number().int().nullable(),
  suggested_sets: z.number().int().nullable(),
  reasoning: z.string().nullable(),
  is_pr_attempt: z.boolean(),
  created_at: z.string(),
  expires_at: z.string(),
  consumed_at: z.string().nullable(),
});

export type NextSessionSuggestion = z.infer<typeof nextSessionSuggestion>;
