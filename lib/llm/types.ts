// Shared LLM types + Zod schemas. Imported by both the RN client and Deno
// Edge Functions. Pure data — no runtime dependencies beyond zod.

import { z } from 'zod';

export type Locale = 'fr' | 'ar' | 'en';
export type LocaleSchemaValue = z.infer<typeof LocaleSchema>;
export const LocaleSchema = z.enum(['fr', 'ar', 'en']);

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ---- Stable error codes returned by every edge function ----
export type AILErrorCode =
  | 'unauthenticated'
  | 'rate_limited'
  | 'quota_exceeded' // hard daily cap across all features
  | 'entitlement_required' // premium-only or feature limit
  | 'invalid_request'
  | 'invalid_input'
  | 'invalid_response'
  | 'insufficient_data'
  | 'invalid_video'
  | 'unsafe_content'
  | 'no_food_detected'
  | 'provider_error';

// ---- Chat ----
export const ChatRequestSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
  locale: LocaleSchema,
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ---- Meal parse ----
export const CookingMethodSchema = z.enum([
  'raw',
  'boiled',
  'steamed',
  'grilled',
  'baked',
  'roasted',
  'fried',
  'deep_fried',
  'sauteed',
  'braised',
  'smoked',
  'unknown',
]);
export type CookingMethod = z.infer<typeof CookingMethodSchema>;

export const MealItemSchema = z.object({
  name: z.string(),
  quantity_g: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative().optional(),
  sugar_g: z.number().nonnegative().optional(),
  sodium_mg: z.number().nonnegative().optional(),
  // How the item was prepared — visibly inferred from the photo. Affects calorie estimates.
  cooking_method: CookingMethodSchema.optional(),
  // Free-form short qualifier ("with parmesan", "in olive oil", "skin-on", etc.) for richer copy.
  detail: z.string().max(80).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});
export const MealMacrosSchema = z.object({
  // True when the photo contains no identifiable food (e.g. empty plate, person, scenery).
  // When true, the edge function rejects the request with `no_food_detected` instead of returning macros.
  no_food_detected: z.boolean().optional(),
  // Primary dish identification. Specific (e.g. "Chicken Caesar Salad") not generic ("salad").
  dish_name: z.string().max(120).optional(),
  // Cuisine bucket — useful for UI tagging and macro priors.
  cuisine: z.string().max(40).optional(),
  // Per-ingredient breakdown (each visible ingredient as its own row).
  items: z.array(MealItemSchema).max(20),
  total: z.object({
    calories: z.number().nonnegative(),
    protein_g: z.number().nonnegative(),
    carbs_g: z.number().nonnegative(),
    fat_g: z.number().nonnegative(),
    fiber_g: z.number().nonnegative().optional(),
    sugar_g: z.number().nonnegative().optional(),
    sodium_mg: z.number().nonnegative().optional(),
  }),
  // Personalized AI assessment.
  verdict: z.enum(['good', 'ok', 'bad']).optional(),
  health_score: z.number().min(1).max(10).optional(),
  summary: z.string().max(400).optional(),
  notes: z.array(z.string().max(240)).max(6).optional(),
  warnings: z.array(z.string().max(240)).max(6).optional(),
  meal_type_guess: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
});
export type MealMacros = z.infer<typeof MealMacrosSchema>;

export const MealParseRequestSchema = z
  .object({
    text: z.string().max(2000).optional(),
    image_url: z.string().url().optional(),
    locale: LocaleSchema,
  })
  .refine((v) => !!v.text?.trim() || !!v.image_url, {
    message: 'text or image_url required',
  });

// ---- "What can I eat?" — pantry scan + macro-aware meal suggestions ----
// Shared by the RN client and the pantry-scan / meal-suggestions edge functions.
// CONTRACT: the model proposes dishes + portions only. Every macro number is
// computed server-side from the food DB (lib/nutrition/macros.ts), never by the
// model. Vision detections are mapped to food_db_id in CODE, never by the model.

export const PantryUnitSchema = z.enum([
  'g',
  'ml',
  'piece',
  'cup',
  'tbsp',
  'tsp',
  'handful',
  'slice',
  'can',
  'unknown',
]);
export type PantryUnit = z.infer<typeof PantryUnitSchema>;

// Model-only vision output: detected ingredients. No food_db_id — the edge
// function resolves each name to a DB row in code (or leaves it unmatched).
export const PantryVisionItemSchema = z.object({
  name: z.string().min(1).max(80),
  quantity: z.number().nonnegative().optional(),
  unit: PantryUnitSchema.optional(),
  confidence: z.number().min(0).max(1),
});
export const PantryVisionOutputSchema = z.object({
  items: z.array(PantryVisionItemSchema).max(40),
  no_food_detected: z.boolean().optional(),
});
export type PantryVisionOutput = z.infer<typeof PantryVisionOutputSchema>;

// Client-facing request/response.
export const PantryScanRequestSchema = z.object({
  image_urls: z.array(z.string().url()).min(1).max(4),
  locale: LocaleSchema,
});
export type PantryScanRequest = z.infer<typeof PantryScanRequestSchema>;

export const PantryScanItemSchema = z.object({
  // Display name (kept even when unmatched so the confirm UI can show it).
  name: z.string(),
  // Mapped food-DB row, or null when nothing matched ("search to add").
  food_db_id: z.string().uuid().nullable(),
  quantity: z.number().nonnegative().nullable(),
  unit: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type PantryScanItem = z.infer<typeof PantryScanItemSchema>;

export const PantryScanResponseSchema = z.object({
  items: z.array(PantryScanItemSchema),
});
export type PantryScanResponse = z.infer<typeof PantryScanResponseSchema>;

export const MacroSetSchema = z.object({
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});
export type MacroSetDTO = z.infer<typeof MacroSetSchema>;

export const MealSuggestionsRequestSchema = z.object({
  confirmed_food_db_ids: z.array(z.string().uuid()).min(1).max(40),
  remaining_macros: MacroSetSchema,
  locale: LocaleSchema,
  ramadan_mode: z.boolean().optional(),
  dietary_prefs: z.array(z.string().max(40)).max(10).optional(),
});
export type MealSuggestionsRequest = z.infer<typeof MealSuggestionsRequestSchema>;

// Model-only output: dishes referencing food_db_ids + gram portions. We
// deliberately exclude ANY macro field so a hallucinated number can't leak.
export const SuggestionDraftItemSchema = z.object({
  food_db_id: z.string().uuid(),
  quantity_g: z.number().positive().max(2000),
});
export const SuggestionDraftSchema = z.object({
  title: z.string().min(1).max(80),
  items: z.array(SuggestionDraftItemSchema).min(1).max(12),
  note: z.string().max(240).optional(),
});
export const SuggestionDraftListSchema = z.object({
  suggestions: z.array(SuggestionDraftSchema).max(6),
});
export type SuggestionDraftList = z.infer<typeof SuggestionDraftListSchema>;

// Enriched, server-computed, client-facing.
export const SuggestionItemSchema = z.object({
  food_db_id: z.string().uuid(),
  name: z.string(),
  quantity_g: z.number(),
  macros: MacroSetSchema,
});
export type SuggestionItem = z.infer<typeof SuggestionItemSchema>;

export const MacroKeySchema = z.enum(['protein', 'carbs', 'fat', 'kcal']);
export const MealSuggestionSchema = z.object({
  title: z.string(),
  note: z.string().optional(),
  items: z.array(SuggestionItemSchema),
  // Code-computed sum of the items' macros.
  macros: MacroSetSchema,
  // Deterministic 0..100 fit to the remaining gap (ranking key).
  fit_score: z.number(),
  // 0..100 of remaining protein this suggestion covers (headline).
  protein_fill_pct: z.number(),
  // Macro still most under-delivered, for the "add a carb source" note.
  shortfall: MacroKeySchema.nullable().optional(),
});
export type MealSuggestion = z.infer<typeof MealSuggestionSchema>;

export const MealSuggestionsResponseSchema = z.object({
  suggestions: z.array(MealSuggestionSchema),
  // True when even the best suggestion is a weak fit (graceful no-match state).
  best_is_weak: z.boolean(),
});
export type MealSuggestionsResponse = z.infer<typeof MealSuggestionsResponseSchema>;

// ---- Program generation ----
export const ProgramExerciseSchema = z.object({
  name: z.string().min(1),
  muscle_group: z.string().min(1),
  sets: z.number().int().positive().max(10),
  reps: z.string().min(1).max(20),
  rpe: z.number().min(1).max(10).optional(),
  rest_seconds: z.number().int().nonnegative().max(900),
  notes: z.string().max(500).optional(),
});
export const ProgramDaySchema = z.object({
  week: z.number().int().min(1).max(16),
  day_index: z.number().int().min(0).max(6),
  name: z.string().min(1),
  exercises: z.array(ProgramExerciseSchema).min(1).max(15),
});
export const ProgramSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  weeks: z.number().int().min(1).max(16),
  days_per_week: z.number().int().min(1).max(7),
  days: z.array(ProgramDaySchema).min(1),
});
export type Program = z.infer<typeof ProgramSchema>;

export const GenerateProgramRequestSchema = z.object({
  goal: z.enum(['hypertrophy', 'strength', 'recomp']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  days_per_week: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  equipment: z.enum(['full_gym', 'home_dumbbells', 'bodyweight', 'minimal']),
  weeks: z.union([z.literal(4), z.literal(8), z.literal(12)]),
  preferences: z.string().max(1000).optional(),
  locale: LocaleSchema,
});
export type GenerateProgramRequest = z.infer<typeof GenerateProgramRequestSchema>;

// ---- Program adjust ----
export const AdjustmentSchema = z.object({
  summary: z.string().max(800),
  adjustments: z
    .array(
      z.object({
        type: z.enum([
          'increase_weight',
          'decrease_weight',
          'change_reps',
          'swap_exercise',
          'add_set',
          'deload',
        ]),
        program_exercise_id: z.string().uuid(),
        detail: z.record(z.unknown()),
        reasoning: z.string().max(500),
      }),
    )
    .max(20),
});
export type Adjustment = z.infer<typeof AdjustmentSchema>;

export const AdjustProgramRequestSchema = z.object({
  program_id: z.string().uuid(),
});

// ---- Form check ----
export const FormFeedbackSchema = z.object({
  overall_score: z.number().int().min(1).max(10),
  what_is_good: z.array(z.string().max(300)).max(8),
  what_to_fix: z
    .array(
      z.object({
        issue: z.string().max(300),
        severity: z.enum(['minor', 'moderate', 'major']),
        suggestion: z.string().max(500),
      }),
    )
    .max(8),
  safety_warning: z.string().max(500).optional(),
});
export type FormFeedback = z.infer<typeof FormFeedbackSchema>;

export const FormCheckRequestSchema = z.object({
  exercise_id: z.string().uuid(),
  // 4–6 frame URLs in Supabase Storage owned by the user.
  frame_urls: z.array(z.string().url()).min(3).max(6),
  // Original video URL — kept for the storage TTL job.
  video_url: z.string().url(),
  locale: LocaleSchema,
});
export type FormCheckRequest = z.infer<typeof FormCheckRequestSchema>;

// ---- Equipment scan ----
export const EquipmentScanRequestSchema = z.object({
  image_url: z.string().url(),
  locale: LocaleSchema,
});
export type EquipmentScanRequest = z.infer<typeof EquipmentScanRequestSchema>;

export const EquipmentDetailsSchema = z.object({
  name_fr: z.string().min(1).max(120),
  name_ar: z.string().min(1).max(120),
  name_en: z.string().min(1).max(120),
  confidence: z.enum(['high', 'medium', 'low']),
  primary_muscles: z.array(z.string().min(1).max(40)).min(1).max(6),
  secondary_muscles: z.array(z.string().min(1).max(40)).max(6),
  type: z.enum(['machine', 'free_weight', 'cable', 'bodyweight', 'cardio']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  common_mistakes: z.array(z.string().min(1).max(240)).max(4),
  safety_notes: z.array(z.string().min(1).max(240)).max(3),
  suggested_weight_range: z
    .object({
      beginner_kg: z.number().min(0).max(400).nullable(),
      intermediate_kg: z.number().min(0).max(400).nullable(),
      advanced_kg: z.number().min(0).max(400).nullable(),
    })
    .nullable(),
  // How to use the equipment — a short coaching tutorial.
  setup_tips: z.array(z.string().min(1).max(240)).max(4).optional(),
  tutorial_steps: z.array(z.string().min(1).max(280)).min(3).max(8).optional(),
  breathing_cue: z.string().min(1).max(240).optional(),
  pro_tip: z.string().min(1).max(240).optional(),
});
export type EquipmentDetails = z.infer<typeof EquipmentDetailsSchema>;

export const EquipmentMatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  instructions: z.string().nullable(),
  video_url: z.string().nullable(),
  photo_url: z.string().nullable(),
});
export type EquipmentMatch = z.infer<typeof EquipmentMatchSchema>;

export const EquipmentScanResponseSchema = z.object({
  equipment: EquipmentDetailsSchema.nullable(),
  matched_exercises: z.array(EquipmentMatchSchema).max(8),
  unrecognized: z.boolean(),
});
export type EquipmentScanResponse = z.infer<typeof EquipmentScanResponseSchema>;

// AI-only payload (subset of the response — DB matches are added server-side).
export const EquipmentVisionOutputSchema = z.object({
  equipment: EquipmentDetailsSchema.nullable(),
  unrecognized: z.boolean(),
});
export type EquipmentVisionOutput = z.infer<typeof EquipmentVisionOutputSchema>;

// ---- Workout generation (single workout, not a multi-week program) ----
export const GenerateWorkoutRequestSchema = z.object({
  type: z.enum(['today', 'specific_session']),
  session_focus: z
    .enum(['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom'])
    .optional(),
  custom_focus: z.string().max(240).optional(),
  duration_minutes: z.union([
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(75),
    z.literal(90),
  ]),
  equipment_override: z.enum(['full_gym', 'home_dumbbells', 'bodyweight', 'minimal']).optional(),
  locale: LocaleSchema,
});
export type GenerateWorkoutRequest = z.infer<typeof GenerateWorkoutRequestSchema>;

export const WorkoutExerciseSchema = z.object({
  matched_exercise_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(120),
  muscle_group: z.string().min(1).max(40),
  is_warmup: z.boolean(),
  sets: z.number().int().min(1).max(10),
  rep_scheme: z.string().min(1).max(20),
  target_rpe: z.number().min(1).max(10),
  rest_seconds: z.number().int().min(0).max(600),
  notes: z.string().max(400),
  superset_with_index: z.number().int().min(0).max(20).nullable(),
});
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;

export const GeneratedWorkoutSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(600),
  estimated_duration_min: z.number().int().min(10).max(180),
  focus: z.string().min(1).max(60),
  reasoning: z.string().min(1).max(800),
  exercises: z.array(WorkoutExerciseSchema).min(2).max(15),
  warm_up_protocol: z.string().max(400),
  cool_down_protocol: z.string().max(400),
});
export type GeneratedWorkout = z.infer<typeof GeneratedWorkoutSchema>;

// AI-only payload — the same minus matched_exercise_id (resolved server-side).
export const WorkoutAiOutputSchema = GeneratedWorkoutSchema.omit({
  exercises: true,
}).extend({
  exercises: z.array(WorkoutExerciseSchema.omit({ matched_exercise_id: true })),
});
export type WorkoutAiOutput = z.infer<typeof WorkoutAiOutputSchema>;

// ---- Exercise alternatives ----
export const ExerciseAlternativesRequestSchema = z.object({
  exercise_id: z.string().uuid(),
  reason: z.enum(['injury', 'no_equipment', 'variety', 'too_hard', 'too_easy']).optional(),
  available_equipment: z.string().max(60).optional(),
  locale: LocaleSchema,
});
export type ExerciseAlternativesRequest = z.infer<typeof ExerciseAlternativesRequestSchema>;

export const ExerciseAlternativeSchema = z.object({
  matched_exercise_id: z.string().uuid().nullable(),
  name: z.string().min(1).max(120),
  why: z.string().max(240),
  equipment: z.string().max(40),
});
export const ExerciseAlternativesResponseSchema = z.object({
  alternatives: z.array(ExerciseAlternativeSchema).min(1).max(5),
});
export type ExerciseAlternativesResponse = z.infer<typeof ExerciseAlternativesResponseSchema>;

// ---- Generate-program preview-mode addition ----
export const GenerateProgramExtendedRequestSchema = z.object({
  goal: z.enum(['hypertrophy', 'strength', 'recomp']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  days_per_week: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  equipment: z.enum(['full_gym', 'home_dumbbells', 'bodyweight', 'minimal']),
  weeks: z.union([z.literal(4), z.literal(8), z.literal(12)]),
  preferences: z.string().max(1000).optional(),
  locale: LocaleSchema,
  // 'preview' returns the plan + reasoning without persisting; 'save' persists
  // (legacy behavior). Defaults to 'save' for backwards compat.
  mode: z.enum(['preview', 'save']).optional(),
});

// Extended program schema with reasoning. The AI returns this; the persist
// helper only reads the fields that map to columns.
export const ProgramWithReasoningSchema = ProgramSchema.extend({
  program_reasoning: z.string().max(800).optional(),
});

// ---- LLM provider abstraction ----
export interface LLMChatOptions {
  model: string;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LLMStructuredOptions<T> {
  model: string;
  schema: z.ZodType<T>;
  schemaName: string;
  temperature?: number;
  maxOutputTokens?: number;
  // OpenAI-flavoured JSON schema. Built by the provider from the Zod schema if absent.
  jsonSchema?: Record<string, unknown>;
}

export interface LLMVisionOptions<T> extends LLMStructuredOptions<T> {
  imageUrls: string[];
}

export interface LLMTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMStructuredResult<T> {
  data: T;
  usage: LLMTokenUsage;
}

// Streaming chunk for SSE. `usage` arrives only on the final chunk.
export interface LLMStreamChunk {
  delta?: string;
  usage?: LLMTokenUsage;
  done?: boolean;
}
