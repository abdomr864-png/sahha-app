export { coachSystemPrompt } from './coach.ts';
export { programGenSystemPrompt } from './program-gen.ts';
export { programAdjustSystemPrompt } from './program-adjust.ts';
export { formCheckSystemPrompt } from './form-check.ts';
export { mealParseSystemPrompt } from './meal-parse.ts';
export { equipmentScanSystemPrompt } from './equipment-scan.ts';
export { workoutGenSystemPrompt } from './workout-gen.ts';
export { exerciseAltSystemPrompt } from './exercise-alternatives.ts';

export function localeInstruction(locale: 'fr' | 'ar' | 'en'): string {
  switch (locale) {
    case 'fr':
      return 'Reply in French.';
    case 'ar':
      return 'Reply in Arabic.';
    default:
      return 'Reply in English.';
  }
}
