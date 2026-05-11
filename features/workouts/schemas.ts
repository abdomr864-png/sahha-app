import { z } from 'zod';

export const exerciseFilterSchema = z.object({
  query: z.string().default(''),
  muscleGroup: z.string().nullable().default(null),
  equipment: z.string().nullable().default(null),
});
export type ExerciseFilter = z.infer<typeof exerciseFilterSchema>;

export const exerciseLiteSchema = z.object({
  id: z.string().uuid(),
  name_en: z.string(),
  name_fr: z.string(),
  name_ar: z.string(),
  muscle_group: z.string(),
  equipment: z.string(),
});
export type ExerciseLite = z.infer<typeof exerciseLiteSchema>;

export const setDraftSchema = z.object({
  id: z.string().uuid(),
  set_index: z.number().int().min(1),
  reps: z.number().int().min(0),
  weight_kg: z.number().min(0),
  rpe: z.number().min(1).max(10).nullable(),
  is_warmup: z.boolean().default(false),
  is_drop_set: z.boolean().default(false),
  completed: z.boolean().default(false),
});

export const workoutExerciseDraftSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  order_index: z.number().int().min(0),
  target_sets: z.number().int().nullable().default(null),
  target_reps: z.number().int().nullable().default(null),
  target_rpe: z.number().nullable().default(null),
  rest_seconds: z.number().int().nullable().default(null),
  notes: z.string().nullable().default(null),
  sets: z.array(setDraftSchema).default([]),
});

export const workoutDraftSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().nullable().default(null),
  started_at: z.string(),
  ended_at: z.string().nullable().default(null),
  exercises: z.array(workoutExerciseDraftSchema).default([]),
});
export type WorkoutDraft = z.infer<typeof workoutDraftSchema>;
export type WorkoutExerciseDraft = z.infer<typeof workoutExerciseDraftSchema>;
export type SetDraft = z.infer<typeof setDraftSchema>;
