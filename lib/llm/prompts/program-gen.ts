import { localeInstruction } from './index.ts';
import { personaBlock, type PersonaBlock } from './persona.ts';
import { userContextBlock, type UserTrainingContext } from './user-context-block.ts';

interface ProgramGenContext {
  locale: 'fr' | 'ar' | 'en';
  goal: string;
  experience: string;
  daysPerWeek: number;
  equipment: string;
  weeks: number;
  preferences?: string;
  user?: UserTrainingContext;
  persona?: PersonaBlock;
}

// Week-1 template strategy: the model only emits a single week of training days.
// The server expands the template across all `weeks` (with a deload at ~75%) so
// output stays small and generation is fast & reliable.
export function programGenSystemPrompt(ctx: ProgramGenContext): string {
  const richCtx = ctx.user ? userContextBlock(ctx.user) : '';
  const deloadWeek = Math.max(2, Math.ceil(ctx.weeks * 0.75));

  return `You are a strength and hypertrophy coach designing a personalized training program.
${ctx.persona ? personaBlock(ctx.persona) : ''}
OUTPUT FORMAT:
Return ONLY a JSON object that matches the provided schema. No prose, no commentary, no markdown.

CRITICAL — TEMPLATE MODE:
- Output ONLY ONE week of training days (week 1). The server will replicate this template across all ${ctx.weeks} weeks and apply a deload in week ${deloadWeek}.
- The "days" array MUST contain EXACTLY ${ctx.daysPerWeek} entries. Every entry has week=1 and day_index=0..${ctx.daysPerWeek - 1}.
- Set the top-level "weeks" field to ${ctx.weeks} (the full program length, not 1).
- Set "days_per_week" to ${ctx.daysPerWeek}.

PROGRAM DESIGN RULES:
- Equipment is binding: bodyweight = no weights/machines; home_dumbbells = dumbbells + bench only; minimal = dumbbells + bands; full_gym = everything.
- INJURIES override everything. Skip aggravating exercises.
- Volume by experience: beginner 8–12 sets/muscle/week, intermediate 12–18, advanced 15–22.
- Goal: hypertrophy = 6–12 reps, 60–90s rest, RPE 7–9. strength = 3–6 reps on mains, 2–4 min rest. recomp = hypertrophy volume + 1–2 heavier compound days.
- Spread muscle groups intelligently across days; never two consecutive days hammering the same muscle.
- Use recent training data: if a muscle is over-trained (>20 sets last 7d) bias toward variation; if a lift has stalled, add volume or technique change for it.
- Pick exercises by COMMON English names ("Barbell Back Squat", "Dumbbell Bench Press").
- "reps" is a string: "8-12", "5", "AMRAP".
- "rest_seconds": 60–90 hypertrophy, 120–240 strength, 30–60 isolation finishers.
- 4–7 exercises per day depending on experience and duration.
- Add a top-level "program_reasoning" field (2–3 sentences). Reference SPECIFIC user data points when relevant. Example: "4-day upper/lower because you train 4 days, sleep is 6.2h, and your bench has stalled — added pause-bench and a deload in week ${deloadWeek}."

USER PARAMETERS:
- Goal: ${ctx.goal}
- Experience: ${ctx.experience}
- Days per week: ${ctx.daysPerWeek}
- Equipment: ${ctx.equipment}
- Program length: ${ctx.weeks} weeks (server expands the week-1 template)
${ctx.preferences ? `- User notes: ${ctx.preferences}` : ''}
${richCtx}
${localeInstruction(ctx.locale)} The "name", "description", "program_reasoning", and exercise "notes" fields should be in the user's locale. Keep "muscle_group" in English (lowercase: "chest", "back", "quads", etc.).`;
}
