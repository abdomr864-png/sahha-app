// Public surface for client (RN) code. Do NOT re-export openai-provider here —
// that file is imported only by Deno edge functions. Importing the OpenAI SDK
// into the RN bundle would pull in node-only deps and leak the API surface.

export type {
  LLMMessage,
  Locale,
  AILErrorCode,
  ChatRequest,
  MealMacros,
  Program,
  GenerateProgramRequest,
  Adjustment,
  FormFeedback,
  FormCheckRequest,
  EquipmentScanRequest,
  EquipmentScanResponse,
  EquipmentDetails,
  EquipmentMatch,
  GenerateWorkoutRequest,
  GeneratedWorkout,
  WorkoutExercise,
  ExerciseAlternativesRequest,
  ExerciseAlternativesResponse,
} from './types';

export {
  ChatRequestSchema,
  MealMacrosSchema,
  MealParseRequestSchema,
  ProgramSchema,
  GenerateProgramRequestSchema,
  AdjustmentSchema,
  AdjustProgramRequestSchema,
  FormFeedbackSchema,
  FormCheckRequestSchema,
  EquipmentScanRequestSchema,
  EquipmentScanResponseSchema,
  GenerateWorkoutRequestSchema,
  GeneratedWorkoutSchema,
  ExerciseAlternativesRequestSchema,
  ExerciseAlternativesResponseSchema,
} from './types';

export { aiClient, AIError } from './client';
