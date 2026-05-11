import { localeInstruction } from './index.ts';

export interface ExerciseAltContext {
  locale: 'fr' | 'ar' | 'en';
  exercise_name: string;
  muscle_group: string;
  current_equipment: string;
  reason?: string;
  available_equipment?: string;
  injuries?: string[];
}

export function exerciseAltSystemPrompt(ctx: ExerciseAltContext): string {
  const why = ctx.reason ? `Reason for swapping: ${ctx.reason}.` : 'Reason: variety.';
  const inj = ctx.injuries?.length ? `Injuries: ${ctx.injuries.join(', ')}.` : '';
  return `You are a strength coach suggesting 3 substitute exercises for "${ctx.exercise_name}" (primary muscle: ${ctx.muscle_group}, equipment: ${ctx.current_equipment}).

${why} ${inj}
${ctx.available_equipment ? `Available equipment: ${ctx.available_equipment}.` : ''}

OUTPUT FORMAT:
Return ONLY a JSON object matching the schema. No prose.

RULES:
- Suggest 3 alternatives that train the SAME primary muscle with comparable activation.
- Prefer COMMON English names that exist in a standard exercise library.
- "why": one short sentence explaining the trade-off (load profile, joint stress, equipment swap).
- "equipment": one of: barbell, dumbbell, kettlebell, cable, machine, bodyweight.
- If the user listed an injury, the alternatives must NOT aggravate it.

${localeInstruction(ctx.locale)} The "name" and "why" fields must be in the user's locale.`;
}
