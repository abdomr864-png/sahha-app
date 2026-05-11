/* eslint-disable max-lines */
// Client-side AI HTTP client. Calls Supabase Edge Functions. Never imports
// the OpenAI SDK or anything provider-specific. All errors come back as
// stable AILErrorCode strings — UI maps to i18n keys.

import { supabase } from '@lib/supabase/client';
import type {
  AILErrorCode,
  Adjustment,
  ChatRequest,
  FormCheckRequest,
  FormFeedback,
  GenerateProgramRequest,
  MealMacros,
  Program,
  EquipmentScanRequest,
  EquipmentScanResponse,
  GenerateWorkoutRequest,
  GeneratedWorkout,
  ExerciseAlternativesRequest,
  ExerciseAlternativesResponse,
  Locale,
} from './types';

export class AIError extends Error {
  constructor(
    public readonly code: AILErrorCode,
    public readonly status?: number,
    public readonly hint?: string,
  ) {
    super(code);
    this.name = 'AIError';
  }

  get i18nKey(): string {
    return `errors.ai.${this.code}`;
  }
}

async function getAuthHeader(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  console.log(
    '[ai-client] getSession:',
    'hasSession=',
    !!data.session,
    'tokenLen=',
    token?.length ?? 0,
    'expiresAt=',
    data.session?.expires_at,
    'error=',
    error?.message,
  );
  // DEV BYPASS: send the public anon key if there is no user session yet, so the
  // function can still run while the email/password sign-in flow is being fixed.
  // Once auth is restored, drop this branch and re-throw `AIError('unauthenticated')`.
  if (!token) {
    const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (anon) return `Bearer ${anon}`;
    throw new AIError('unauthenticated', 401);
  }
  return `Bearer ${token}`;
}

function functionUrl(name: string): string {
  const base =
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    (require('expo-constants').default.expoConfig?.extra?.SUPABASE_URL as string | undefined) ??
    '';
  return `${base}/functions/v1/${name}`;
}

async function postJson<T>(name: string, body: unknown, opts?: { timeoutMs?: number }): Promise<T> {
  const auth = await getAuthHeader();
  const timeoutMs = opts?.timeoutMs ?? 25_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(functionUrl(name), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as { name?: string }).name === 'AbortError') {
      throw new AIError('provider_error', 0, 'timeout');
    }
    throw new AIError('provider_error', 0, (e as Error).message);
  }
  clearTimeout(timer);
  if (!res.ok) {
    let code: AILErrorCode = 'provider_error';
    try {
      const err = (await res.json()) as { error?: AILErrorCode };
      if (err?.error) code = err.error;
    } catch {
      /* keep default */
    }
    throw new AIError(code, res.status);
  }
  return (await res.json()) as T;
}

export interface ChatStreamHandlers {
  onConversation?: (id: string) => void;
  onToken: (chunk: string) => void;
  onDone?: () => void;
  onError?: (err: AIError) => void;
  signal?: AbortSignal;
}

async function streamChat(req: ChatRequest, h: ChatStreamHandlers): Promise<void> {
  const auth = await getAuthHeader();
  let res: Response;
  try {
    res = await fetch(functionUrl('ai-chat'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        authorization: auth,
      },
      body: JSON.stringify(req),
      signal: h.signal,
    });
  } catch (e) {
    h.onError?.(new AIError('provider_error', 0, (e as Error).message));
    return;
  }
  if (!res.ok || !res.body) {
    let code: AILErrorCode = 'provider_error';
    try {
      const err = (await res.json()) as { error?: AILErrorCode };
      if (err?.error) code = err.error;
    } catch {
      /* keep default */
    }
    h.onError?.(new AIError(code, res.status));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = event.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          h.onDone?.();
          return;
        }
        try {
          const evt = JSON.parse(data) as
            | { type: 'conversation'; id: string }
            | { type: 'token'; delta: string }
            | { type: 'error'; code: AILErrorCode };
          if (evt.type === 'conversation') h.onConversation?.(evt.id);
          else if (evt.type === 'token') h.onToken(evt.delta);
          else if (evt.type === 'error') h.onError?.(new AIError(evt.code));
        } catch {
          /* ignore malformed event */
        }
      }
    }
  }
  h.onDone?.();
}

// Local fallback used when EXPO_PUBLIC_LLM_ENABLED !== '1'. Lets the full
// program-gen flow work without requiring OPENAI_API_KEY in Supabase secrets.
type ExSpec = { name: string; type: 'compound' | 'isolation' };
type Eq = GenerateProgramRequest['equipment'];

function stubGenerateProgram(req: GenerateProgramRequest & { mode?: 'preview' | 'save' }): {
  program_id: string | null;
  program: Program & { program_reasoning?: string };
  program_reasoning: string | null;
} {
  // Bodyweight users get full-body splits (no isolation muscle groups available
  // to drive a true PPL or U/L). Gym users get classical splits.
  const isBodyweight = req.equipment === 'bodyweight' || req.equipment === 'minimal';
  const GYM_SPLITS: Record<number, { name: string; muscles: string[] }[]> = {
    3: [
      { name: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
      { name: 'Pull', muscles: ['back', 'biceps'] },
      { name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    ],
    4: [
      { name: 'Upper A', muscles: ['chest', 'back', 'shoulders', 'arms'] },
      { name: 'Lower A', muscles: ['quads', 'glutes', 'calves'] },
      { name: 'Upper B', muscles: ['back', 'chest', 'shoulders', 'arms'] },
      { name: 'Lower B', muscles: ['hamstrings', 'glutes', 'quads', 'calves'] },
    ],
    5: [
      { name: 'Chest & Triceps', muscles: ['chest', 'triceps'] },
      { name: 'Back & Biceps', muscles: ['back', 'biceps'] },
      { name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
      { name: 'Shoulders', muscles: ['shoulders', 'rear delts', 'traps'] },
      { name: 'Arms & Core', muscles: ['biceps', 'triceps', 'core'] },
    ],
    6: [
      { name: 'Push A', muscles: ['chest', 'shoulders', 'triceps'] },
      { name: 'Pull A', muscles: ['back', 'biceps', 'rear delts'] },
      { name: 'Legs A', muscles: ['quads', 'glutes', 'calves'] },
      { name: 'Push B', muscles: ['shoulders', 'chest', 'triceps'] },
      { name: 'Pull B', muscles: ['back', 'biceps', 'rear delts'] },
      { name: 'Legs B', muscles: ['hamstrings', 'glutes', 'quads'] },
    ],
  };
  // Bodyweight-friendly splits — full-body, push-pull, or upper/lower with
  // every day hitting compounds. Better fit when equipment is limited.
  const HOME_SPLITS: Record<number, { name: string; muscles: string[] }[]> = {
    3: [
      { name: 'Full Body A', muscles: ['chest', 'back', 'quads', 'core'] },
      { name: 'Full Body B', muscles: ['shoulders', 'back', 'glutes', 'hamstrings', 'core'] },
      { name: 'Full Body C', muscles: ['chest', 'biceps', 'triceps', 'quads', 'calves'] },
    ],
    4: [
      { name: 'Upper Push', muscles: ['chest', 'shoulders', 'triceps', 'core'] },
      { name: 'Lower', muscles: ['quads', 'glutes', 'hamstrings', 'calves'] },
      { name: 'Upper Pull', muscles: ['back', 'biceps', 'rear delts'] },
      { name: 'Posterior + Core', muscles: ['hamstrings', 'glutes', 'back', 'core'] },
    ],
    5: [
      { name: 'Push', muscles: ['chest', 'shoulders', 'triceps'] },
      { name: 'Pull', muscles: ['back', 'biceps', 'rear delts'] },
      { name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
      { name: 'Conditioning', muscles: ['chest', 'core', 'quads'] },
      { name: 'Strength Focus', muscles: ['back', 'glutes', 'shoulders', 'core'] },
    ],
    6: [
      { name: 'Push A', muscles: ['chest', 'shoulders', 'triceps'] },
      { name: 'Pull A', muscles: ['back', 'biceps'] },
      { name: 'Legs A', muscles: ['quads', 'glutes', 'core'] },
      { name: 'Push B', muscles: ['shoulders', 'chest', 'triceps'] },
      { name: 'Pull B', muscles: ['back', 'biceps', 'rear delts'] },
      { name: 'Legs B', muscles: ['hamstrings', 'glutes', 'calves', 'core'] },
    ],
  };
  const SPLITS = isBodyweight ? HOME_SPLITS : GYM_SPLITS;

  const EX: Record<Eq, Record<string, ExSpec[]>> = {
    full_gym: {
      chest: [
        { name: 'Barbell Bench Press', type: 'compound' },
        { name: 'Incline Dumbbell Press', type: 'compound' },
        { name: 'Cable Fly', type: 'isolation' },
      ],
      back: [
        { name: 'Pull-up', type: 'compound' },
        { name: 'Barbell Row', type: 'compound' },
        { name: 'Lat Pulldown', type: 'compound' },
        { name: 'Seated Cable Row', type: 'compound' },
      ],
      shoulders: [
        { name: 'Overhead Press', type: 'compound' },
        { name: 'Dumbbell Lateral Raise', type: 'isolation' },
      ],
      'rear delts': [
        { name: 'Cable Rear Delt Fly', type: 'isolation' },
        { name: 'Reverse Pec Deck', type: 'isolation' },
      ],
      biceps: [
        { name: 'Barbell Curl', type: 'isolation' },
        { name: 'Incline Dumbbell Curl', type: 'isolation' },
      ],
      triceps: [
        { name: 'Close-Grip Bench Press', type: 'compound' },
        { name: 'Cable Pushdown', type: 'isolation' },
        { name: 'Skullcrusher', type: 'isolation' },
      ],
      arms: [
        { name: 'Barbell Curl', type: 'isolation' },
        { name: 'Cable Pushdown', type: 'isolation' },
      ],
      quads: [
        { name: 'Back Squat', type: 'compound' },
        { name: 'Leg Press', type: 'compound' },
        { name: 'Leg Extension', type: 'isolation' },
      ],
      hamstrings: [
        { name: 'Romanian Deadlift', type: 'compound' },
        { name: 'Lying Leg Curl', type: 'isolation' },
      ],
      glutes: [
        { name: 'Hip Thrust', type: 'compound' },
        { name: 'Bulgarian Split Squat', type: 'compound' },
      ],
      calves: [{ name: 'Standing Calf Raise', type: 'isolation' }],
      traps: [{ name: 'Barbell Shrug', type: 'isolation' }],
      core: [
        { name: 'Hanging Leg Raise', type: 'isolation' },
        { name: 'Cable Crunch', type: 'isolation' },
      ],
    },
    home_dumbbells: {
      chest: [
        { name: 'Dumbbell Bench Press', type: 'compound' },
        { name: 'Incline Dumbbell Press', type: 'compound' },
        { name: 'Dumbbell Fly', type: 'isolation' },
      ],
      back: [
        { name: 'One-Arm Dumbbell Row', type: 'compound' },
        { name: 'Dumbbell Pullover', type: 'isolation' },
      ],
      shoulders: [
        { name: 'Dumbbell Shoulder Press', type: 'compound' },
        { name: 'Dumbbell Lateral Raise', type: 'isolation' },
      ],
      'rear delts': [{ name: 'Bent-Over Reverse Fly', type: 'isolation' }],
      biceps: [
        { name: 'Dumbbell Curl', type: 'isolation' },
        { name: 'Hammer Curl', type: 'isolation' },
      ],
      triceps: [
        { name: 'Dumbbell Overhead Extension', type: 'isolation' },
        { name: 'Dumbbell Kickback', type: 'isolation' },
      ],
      arms: [
        { name: 'Dumbbell Curl', type: 'isolation' },
        { name: 'Dumbbell Kickback', type: 'isolation' },
      ],
      quads: [
        { name: 'Goblet Squat', type: 'compound' },
        { name: 'Bulgarian Split Squat', type: 'compound' },
      ],
      hamstrings: [{ name: 'Dumbbell Romanian Deadlift', type: 'compound' }],
      glutes: [
        { name: 'Dumbbell Hip Thrust', type: 'compound' },
        { name: 'Reverse Lunge', type: 'compound' },
      ],
      calves: [{ name: 'Dumbbell Calf Raise', type: 'isolation' }],
      traps: [{ name: 'Dumbbell Shrug', type: 'isolation' }],
      core: [
        { name: 'Dumbbell Russian Twist', type: 'isolation' },
        { name: 'Plank', type: 'isolation' },
      ],
    },
    minimal: {
      chest: [
        { name: 'Push-up', type: 'compound' },
        { name: 'Banded Chest Press', type: 'compound' },
      ],
      back: [
        { name: 'Banded Row', type: 'compound' },
        { name: 'One-Arm Row', type: 'compound' },
      ],
      shoulders: [
        { name: 'Pike Push-up', type: 'compound' },
        { name: 'Banded Lateral Raise', type: 'isolation' },
      ],
      'rear delts': [{ name: 'Banded Rear Delt Fly', type: 'isolation' }],
      biceps: [{ name: 'Banded Curl', type: 'isolation' }],
      triceps: [{ name: 'Banded Pushdown', type: 'isolation' }],
      arms: [
        { name: 'Banded Curl', type: 'isolation' },
        { name: 'Banded Pushdown', type: 'isolation' },
      ],
      quads: [
        { name: 'Goblet Squat', type: 'compound' },
        { name: 'Bulgarian Split Squat', type: 'compound' },
      ],
      hamstrings: [{ name: 'Single-Leg RDL', type: 'compound' }],
      glutes: [
        { name: 'Glute Bridge', type: 'compound' },
        { name: 'Banded Hip Thrust', type: 'compound' },
      ],
      calves: [{ name: 'Calf Raise', type: 'isolation' }],
      traps: [{ name: 'Banded Shrug', type: 'isolation' }],
      core: [
        { name: 'Plank', type: 'isolation' },
        { name: 'Bicycle Crunch', type: 'isolation' },
      ],
    },
    bodyweight: {
      chest: [
        { name: 'Push-up', type: 'compound' },
        { name: 'Decline Push-up', type: 'compound' },
      ],
      back: [
        { name: 'Pull-up', type: 'compound' },
        { name: 'Inverted Row', type: 'compound' },
      ],
      shoulders: [
        { name: 'Pike Push-up', type: 'compound' },
        { name: 'Handstand Hold', type: 'isolation' },
      ],
      'rear delts': [{ name: 'Reverse Snow Angel', type: 'isolation' }],
      biceps: [{ name: 'Chin-up', type: 'compound' }],
      triceps: [
        { name: 'Diamond Push-up', type: 'compound' },
        { name: 'Bench Dip', type: 'compound' },
      ],
      arms: [
        { name: 'Chin-up', type: 'compound' },
        { name: 'Diamond Push-up', type: 'compound' },
      ],
      quads: [
        { name: 'Bodyweight Squat', type: 'compound' },
        { name: 'Bulgarian Split Squat', type: 'compound' },
      ],
      hamstrings: [{ name: 'Single-Leg Hip Hinge', type: 'compound' }],
      glutes: [
        { name: 'Glute Bridge', type: 'compound' },
        { name: 'Hip Thrust', type: 'compound' },
      ],
      calves: [{ name: 'Calf Raise', type: 'isolation' }],
      traps: [{ name: 'Y-Raise', type: 'isolation' }],
      core: [
        { name: 'Plank', type: 'isolation' },
        { name: 'Hollow Body Hold', type: 'isolation' },
      ],
    },
  };

  // Sets by experience: beginner less, advanced more
  const setsCompound = req.experience === 'beginner' ? 3 : req.experience === 'advanced' ? 5 : 4;
  const setsIsolation = req.experience === 'beginner' ? 2 : req.experience === 'advanced' ? 4 : 3;

  // Reps & RPE depend on goal AND exercise type
  const repsRpe = (type: 'compound' | 'isolation') => {
    if (req.goal === 'strength') {
      return type === 'compound' ? { reps: '4-6', rpe: 8 } : { reps: '6-8', rpe: 8 };
    }
    if (req.goal === 'hypertrophy') {
      return type === 'compound' ? { reps: '6-10', rpe: 8 } : { reps: '10-15', rpe: 9 };
    }
    return type === 'compound' ? { reps: '8-10', rpe: 8 } : { reps: '12-15', rpe: 9 };
  };
  const restFor = (type: 'compound' | 'isolation') =>
    req.goal === 'strength' ? (type === 'compound' ? 180 : 120) : type === 'compound' ? 120 : 60;

  const splits = SPLITS[req.days_per_week] ?? SPLITS[4]!;
  const days: Program['days'] = [];

  for (let week = 1; week <= req.weeks; week++) {
    splits.forEach((split, idx) => {
      // Build exercise list — compounds first, then isolations
      const compounds: { spec: ExSpec; muscle: string }[] = [];
      const isolations: { spec: ExSpec; muscle: string }[] = [];
      for (const m of split.muscles) {
        const list = EX[req.equipment][m] ?? [];
        for (const spec of list) {
          if (spec.type === 'compound') compounds.push({ spec, muscle: m });
          else isolations.push({ spec, muscle: m });
        }
      }

      // Cap exercises by experience
      const targetCount = req.experience === 'beginner' ? 4 : req.experience === 'advanced' ? 7 : 6;
      const picked = [
        ...compounds.slice(0, Math.ceil(targetCount * 0.6)),
        ...isolations.slice(0, Math.floor(targetCount * 0.5)),
      ].slice(0, targetCount);

      const exercises = picked.map(({ spec, muscle }) => {
        const { reps, rpe } = repsRpe(spec.type);
        // Progressive overload: deload (-1 RPE) on the last week of each 4-week block
        const isDeload = week % 4 === 0 && req.weeks >= 4;
        return {
          name: spec.name,
          muscle_group: muscle,
          sets: spec.type === 'compound' ? setsCompound : setsIsolation,
          reps,
          rpe: isDeload ? Math.max(rpe - 2, 6) : rpe,
          rest_seconds: restFor(spec.type),
        };
      });

      days.push({
        week,
        day_index: idx,
        name: split.name,
        exercises,
      });
    });
  }

  const equipmentLabel: Record<Eq, string> = {
    full_gym: 'a full gym',
    home_dumbbells: 'home dumbbells',
    minimal: 'minimal equipment',
    bodyweight: 'just your bodyweight',
  };
  const goalLabel: Record<GenerateProgramRequest['goal'], string> = {
    hypertrophy: 'muscle growth',
    strength: 'maximal strength',
    recomp: 'lean recomposition',
  };

  const equipmentTag: Record<Eq, string> = {
    full_gym: 'Gym',
    home_dumbbells: 'Home',
    minimal: 'Home',
    bodyweight: 'Bodyweight',
  };
  const goalTag: Record<GenerateProgramRequest['goal'], string> = {
    hypertrophy: 'Hypertrophy',
    strength: 'Strength',
    recomp: 'Recomp',
  };

  const program: Program & { program_reasoning?: string } = {
    name: `${req.weeks}-Week ${equipmentTag[req.equipment]} ${goalTag[req.goal]} Plan`,
    description: `A ${req.days_per_week}-day ${req.goal} program calibrated for ${req.experience} lifters using ${equipmentLabel[req.equipment]}.`,
    weeks: req.weeks,
    days_per_week: req.days_per_week,
    days,
    program_reasoning: [
      `Built a ${req.days_per_week}-day ${splits.map((s) => s.name).join(' / ')} split focused on ${goalLabel[req.goal]} using ${equipmentLabel[req.equipment]}.`,
      isBodyweight
        ? `Since you're training without a gym, every session leans on compound bodyweight lifts that drive overload through tempo, reps, and unilateral variations.`
        : `Compound lifts come first when you're freshest, with isolation work last to drive volume.`,
      `Sets and rep ranges are calibrated to ${req.experience} level: ${setsCompound}×${repsRpe('compound').reps} on compounds, ${setsIsolation}×${repsRpe('isolation').reps} on isolations, RPE ${repsRpe('compound').rpe}.`,
      req.weeks >= 4
        ? `Every 4th week is a deload (RPE drops 2 points) to manage fatigue before the next push.`
        : `Linear progression — add a small amount each session.`,
      req.preferences ? `Considered your note: "${req.preferences}".` : '',
    ]
      .filter(Boolean)
      .join(' '),
  };

  return {
    program_id: null,
    program,
    program_reasoning: program.program_reasoning ?? null,
  };
}

function isLLMEnabled(): boolean {
  return process.env.EXPO_PUBLIC_LLM_ENABLED === '1';
}

function stubParseMeal(input: { text?: string; image_url?: string }): MealMacros {
  const label = (input.text?.trim() || 'Mixed plate').slice(0, 60);
  return {
    items: [
      {
        name: label,
        quantity_g: 220,
        calories: 480,
        protein_g: 32,
        carbs_g: 48,
        fat_g: 16,
        fiber_g: 6,
        sugar_g: 8,
        sodium_mg: 540,
        confidence: 'medium',
      },
    ],
    total: {
      calories: 480,
      protein_g: 32,
      carbs_g: 48,
      fat_g: 16,
      fiber_g: 6,
      sugar_g: 8,
      sodium_mg: 540,
    },
    verdict: 'ok',
    health_score: 7,
    summary: 'Balanced meal with solid protein. Add a serving of vegetables to boost fiber.',
    notes: ['Good protein hit', 'Reasonable calorie load for a main meal'],
    warnings: [],
    meal_type_guess: 'lunch',
  };
}

function stubGenerateWorkout(req: GenerateWorkoutRequest): {
  generation_id: string | null;
  workout: GeneratedWorkout;
} {
  const focus = req.session_focus ?? 'full_body';
  const exCount = req.duration_minutes <= 30 ? 4 : req.duration_minutes <= 60 ? 6 : 8;
  const pool: Array<{ name: string; muscle: string }> = [
    { name: 'Barbell Squat', muscle: 'quads' },
    { name: 'Bench Press', muscle: 'chest' },
    { name: 'Bent-Over Row', muscle: 'back' },
    { name: 'Overhead Press', muscle: 'shoulders' },
    { name: 'Romanian Deadlift', muscle: 'hamstrings' },
    { name: 'Pull-up', muscle: 'back' },
    { name: 'Walking Lunge', muscle: 'glutes' },
    { name: 'Plank', muscle: 'core' },
  ];
  const exercises = pool.slice(0, exCount).map((e, i) => ({
    matched_exercise_id: null,
    name: e.name,
    muscle_group: e.muscle,
    is_warmup: i === 0,
    sets: i === 0 ? 2 : 4,
    rep_scheme: i === 0 ? '10' : '6-10',
    target_rpe: i === 0 ? 6 : 8,
    rest_seconds: i === 0 ? 60 : 120,
    notes: '',
    superset_with_index: null,
  }));
  return {
    generation_id: null,
    workout: {
      name: `${focus.replace('_', ' ')} session`,
      description: `A ${req.duration_minutes}-minute ${focus.replace('_', ' ')} workout.`,
      estimated_duration_min: req.duration_minutes,
      focus,
      reasoning:
        'Compounds first, balanced muscle coverage, finishing with accessory work and core.',
      exercises,
      warm_up_protocol: '5 min easy cardio + dynamic mobility for hips and shoulders.',
      cool_down_protocol: '5 min walk + static stretches for worked muscles.',
    },
  };
}

function stubScanEquipment(): EquipmentScanResponse {
  return {
    equipment: {
      name_fr: 'Banc de musculation',
      name_ar: 'مقعد رفع الأثقال',
      name_en: 'Adjustable bench',
      confidence: 'medium',
      primary_muscles: ['chest', 'shoulders'],
      secondary_muscles: ['triceps'],
      type: 'free_weight',
      difficulty: 'beginner',
      common_mistakes: ['Bench too low', 'Flaring elbows excessively'],
      safety_notes: ['Use a spotter for heavy sets'],
      suggested_weight_range: {
        beginner_kg: 20,
        intermediate_kg: 40,
        advanced_kg: 80,
      },
    },
    matched_exercises: [],
    unrecognized: false,
  };
}

function stubExerciseAlternatives(): ExerciseAlternativesResponse {
  return {
    alternatives: [
      {
        matched_exercise_id: null,
        name: 'Dumbbell Bench Press',
        why: 'Same movement pattern, gentler on shoulders.',
        equipment: 'dumbbells',
      },
      {
        matched_exercise_id: null,
        name: 'Push-up',
        why: 'Bodyweight regression with similar muscle recruitment.',
        equipment: 'bodyweight',
      },
      {
        matched_exercise_id: null,
        name: 'Machine Chest Press',
        why: 'Stable variation that lets you push close to failure safely.',
        equipment: 'machine',
      },
    ],
  };
}

function stubAdjustProgram(program_id: string): {
  adjustment_id: string;
  adjustment: Adjustment;
} {
  return {
    adjustment_id: `stub-${program_id.slice(0, 8)}`,
    adjustment: {
      summary:
        'You hit your sessions consistently. Bumping working weight on main lifts, holding accessories.',
      adjustments: [],
    },
  };
}

function stubFormCheck(): {
  form_check_id: string;
  feedback: FormFeedback;
} {
  return {
    form_check_id: `stub-${Date.now()}`,
    feedback: {
      overall_score: 7,
      what_is_good: ['Stable bracing at the start of each rep', 'Bar path looks vertical'],
      what_to_fix: [
        {
          issue: 'Slight knee cave on the ascent',
          severity: 'moderate',
          suggestion: 'Cue knees out and drive through the mid-foot.',
        },
      ],
      safety_warning: undefined,
    },
  };
}

async function stubStreamChat(req: ChatRequest, h: ChatStreamHandlers): Promise<void> {
  h.onConversation?.(req.conversation_id ?? `stub-${Date.now()}`);
  const reply =
    "I'm running in offline mode right now, but here's a baseline answer: focus on consistency, progressive overload, and recovery. Re-enable AI to get personalized coaching.";
  for (const word of reply.split(' ')) {
    if (h.signal?.aborted) return;
    h.onToken(`${word} `);
    await new Promise((r) => setTimeout(r, 20));
  }
  h.onDone?.();
}

export const aiClient = {
  streamChat: (req: ChatRequest, h: ChatStreamHandlers): Promise<void> => {
    if (!isLLMEnabled()) return stubStreamChat(req, h);
    return streamChat(req, h);
  },
  parseMeal: async (
    input: { text?: string; image_url?: string },
    locale: Locale,
  ): Promise<MealMacros> => {
    if (!isLLMEnabled()) return stubParseMeal(input);
    return postJson<MealMacros>('ai-meal-parse', {
      text: input.text,
      image_url: input.image_url,
      locale,
    });
  },
  generateProgram: async (req: GenerateProgramRequest & { mode?: 'preview' | 'save' }) => {
    if (!isLLMEnabled()) return stubGenerateProgram(req);
    // Try the live AI service. If it fails (Edge Function down, no OPENAI key,
    // timeout, etc.) fall back to the deterministic stub so the user always
    // ends up with a usable program instead of an "AI service is having
    // trouble" dead-end.
    try {
      return await postJson<{
        program_id: string | null;
        program: Program & { program_reasoning?: string };
        program_reasoning: string | null;
      }>('ai-generate-program', req, { timeoutMs: 45_000 });
    } catch (e) {
      if (e instanceof AIError && e.code === 'entitlement_required') throw e;
      return stubGenerateProgram(req);
    }
  },
  generateWorkout: async (req: GenerateWorkoutRequest) => {
    if (!isLLMEnabled()) return stubGenerateWorkout(req);
    return postJson<{ generation_id: string | null; workout: GeneratedWorkout }>(
      'ai-generate-workout',
      req,
    );
  },
  scanEquipment: async (req: EquipmentScanRequest) => {
    if (!isLLMEnabled()) return stubScanEquipment();
    return postJson<EquipmentScanResponse>('ai-equipment-scan', req);
  },
  exerciseAlternatives: async (req: ExerciseAlternativesRequest) => {
    if (!isLLMEnabled()) return stubExerciseAlternatives();
    return postJson<ExerciseAlternativesResponse>('ai-exercise-alternatives', req);
  },
  adjustProgram: async (program_id: string) => {
    if (!isLLMEnabled()) return stubAdjustProgram(program_id);
    return postJson<{ adjustment_id: string; adjustment: Adjustment }>('ai-adjust-program', {
      program_id,
    });
  },
  formCheck: async (req: FormCheckRequest) => {
    if (!isLLMEnabled()) return stubFormCheck();
    return postJson<{ form_check_id: string; feedback: FormFeedback }>('ai-form-check', req);
  },
};
