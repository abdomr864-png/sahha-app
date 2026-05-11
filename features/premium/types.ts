export type Feature =
  | 'ai_chat'
  | 'ai_meal_parse'
  | 'ai_program_gen'
  | 'ai_program_regenerate'
  | 'ai_workout_gen'
  | 'ai_form_check'
  | 'ai_program_adjust'
  | 'ai_exercise_alts'
  | 'equipment_scan'
  | 'unlimited_workouts'
  | 'progress_photos';

export interface Entitlement {
  feature: Feature;
  /** True if the user can use the feature right now. */
  allowed: boolean;
  /** Reason a free user is gated. Undefined when `allowed`. */
  reason?: 'limit_reached' | 'premium_only';
  /** Best-effort remaining count for free users; null when unmetered. */
  remaining: number | null;
}
