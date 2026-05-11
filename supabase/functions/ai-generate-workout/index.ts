// AI-generated single workout. Returns the structured plan WITHOUT persisting
// it as a workout — the user reviews + edits in the preview UI before saving
// or starting a session. The unmodified AI output is logged in
// ai_generated_workouts for analytics + abuse detection.
// POST /functions/v1/ai-generate-workout

import { authenticate } from '../_shared/supabase.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import { fetchUserTrainingContext } from '../_shared/user-context.ts';
import { GenerateWorkoutRequestSchema, WorkoutAiOutputSchema } from '../../../lib/llm/types.ts';
import { workoutGenSystemPrompt } from '../../../lib/llm/prompts/workout-gen.ts';
import { getPersonaPromptBlock } from '../../../lib/llm/prompts/persona.ts';
import { MODELS } from '../../../lib/llm/models.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

const DEV_USER_ID = '00000000-0000-0000-0000-000000000000';

const FEATURE = 'ai_workout_gen';
const MODEL = MODELS.workoutGen;

// deno-lint-ignore no-explicit-any
type Admin = any;

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  // DEV BYPASS: see ai-meal-parse.
  let userId = DEV_USER_ID;
  const admin = createAdminClient();
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const auth = await authenticate(req);
    if (!(auth instanceof Response)) userId = auth.userId;
  }
  const isDev = userId === DEV_USER_ID;

  let parsed;
  try {
    parsed = GenerateWorkoutRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  const [userCtx, persona] = await Promise.all([
    isDev ? Promise.resolve({}) : fetchUserTrainingContext(admin, userId),
    isDev ? Promise.resolve(null) : getPersonaPromptBlock(admin, userId),
  ]);

  const systemPrompt = workoutGenSystemPrompt({
    locale: parsed.locale,
    type: parsed.type,
    session_focus: parsed.session_focus,
    custom_focus: parsed.custom_focus,
    duration_minutes: parsed.duration_minutes,
    equipment_override: parsed.equipment_override,
    user: userCtx,
    persona,
  });

  const provider = getOpenAI();
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: "Design today's workout." },
  ];

  const callOnce = () =>
    provider.generateStructured(messages, {
      model: MODEL,
      schema: WorkoutAiOutputSchema,
      schemaName: 'GeneratedWorkout',
      maxOutputTokens: 3500,
      temperature: 0.5,
    });

  let result;
  try {
    result = await callOnce();
  } catch {
    try {
      result = await callOnce();
    } catch (e) {
      const code = (e as Error).message?.includes('parse') ? 'invalid_response' : 'provider_error';
      await logAICall(admin, {
        userId,
        feature: FEATURE,
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        status: 'error',
        errorCode: code,
      });
      return json(502, { error: code });
    }
  }

  // Resolve each exercise name to a row in `exercises` so the client can wire
  // up photos, video, and the same picker used by the manual builder. Unmatched
  // names fall through as is_custom=true rows (created on save, not now).
  const exercisesOut = await Promise.all(
    result.data.exercises.map(async (ex) => ({
      ...ex,
      matched_exercise_id: await findExerciseId(admin, ex.name, ex.muscle_group),
    })),
  );

  const out = { ...result.data, exercises: exercisesOut };

  // Log the AI's raw output for telemetry. Skipped in dev bypass (FK violation
  // on user_id for the dummy UUID). Wrapped so a logging failure doesn't poison
  // the user-facing response.
  let generationId: string | null = null;
  if (!isDev) {
    try {
      const { data: logged } = await admin
        .from('ai_generated_workouts')
        .insert({
          user_id: userId,
          input: parsed,
          output: out,
          reasoning: result.data.reasoning,
        })
        .select('id')
        .single();
      generationId = logged?.id ?? null;
    } catch (e) {
      console.error('[ai-generate-workout] telemetry insert failed:', (e as Error).message);
    }
  }

  await logAICall(admin, {
    userId,
    feature: FEATURE,
    model: MODEL,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    status: 'success',
  });

  return json(200, { generation_id: generationId, workout: out });
});

async function findExerciseId(
  admin: Admin,
  name: string,
  muscleGroup: string,
): Promise<string | null> {
  // Try exact-ish match on any locale. ilike is case-insensitive; 'unknown'
  // muscle filters are skipped if the model returned a non-canonical token.
  const { data: exact } = await admin
    .from('exercises')
    .select('id')
    .or(`name_en.ilike.${name},name_fr.ilike.${name},name_ar.ilike.${name}`)
    .eq('is_custom', false)
    .limit(1)
    .maybeSingle();
  if (exact) return exact.id as string;

  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const lastTok = tokens[tokens.length - 1];
  if (!lastTok) return null;

  const { data: candidates } = await admin
    .from('exercises')
    .select('id, name_en, equipment_aliases')
    .eq('is_custom', false)
    .or(`name_en.ilike.%${lastTok}%,equipment_aliases.cs.{${lastTok}}`)
    .limit(20);

  const muscleLc = muscleGroup.toLowerCase();
  const list = (candidates ?? []) as { id: string; name_en: string }[];
  const best = list.find((c) => tokens.every((t) => c.name_en.toLowerCase().includes(t)));
  if (best) return best.id;

  const { data: byMuscle } = await admin
    .from('exercises')
    .select('id')
    .eq('is_custom', false)
    .eq('muscle_group', muscleLc)
    .ilike('name_en', `%${lastTok}%`)
    .limit(1)
    .maybeSingle();
  return byMuscle?.id ?? null;
}
