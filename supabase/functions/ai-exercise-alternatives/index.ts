// 3 substitute exercises for a given exercise — used by the exercise detail
// screen's "Try alternatives" CTA and the routine preview's swap action.
// POST /functions/v1/ai-exercise-alternatives

import { authenticate } from '../_shared/supabase.ts';
import { checkEntitlement, incrementUsage, isOverHardCap } from '../_shared/entitlement.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import {
  ExerciseAlternativesRequestSchema,
  ExerciseAlternativesResponseSchema,
} from '../../../lib/llm/types.ts';
import { exerciseAltSystemPrompt } from '../../../lib/llm/prompts/exercise-alternatives.ts';
import { MODELS } from '../../../lib/llm/models.ts';

const FEATURE = 'ai_exercise_alts';
const MODEL = MODELS.exerciseAlts;

// deno-lint-ignore no-explicit-any
type Admin = any;

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { userId, admin } = auth;

  let parsed;
  try {
    parsed = ExerciseAlternativesRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  if (await isOverHardCap(admin, userId)) return json(429, { error: 'quota_exceeded' });
  const ent = await checkEntitlement(admin, userId, FEATURE, 1);
  if (!ent.allowed) {
    return json(429, {
      error: ent.reason === 'premium_only' ? 'entitlement_required' : 'rate_limited',
    });
  }

  const [{ data: ex }, { data: profile }] = await Promise.all([
    admin
      .from('exercises')
      .select('id, name_en, muscle_group, equipment')
      .eq('id', parsed.exercise_id)
      .maybeSingle(),
    admin.from('profiles').select('injuries, equipment_access').eq('user_id', userId).maybeSingle(),
  ]);

  if (!ex) return json(404, { error: 'invalid_input' });

  const provider = getOpenAI();
  const systemPrompt = exerciseAltSystemPrompt({
    locale: parsed.locale,
    exercise_name: ex.name_en,
    muscle_group: ex.muscle_group,
    current_equipment: ex.equipment,
    reason: parsed.reason,
    available_equipment: parsed.available_equipment ?? profile?.equipment_access ?? undefined,
    injuries: (profile?.injuries as string[] | null) ?? undefined,
  });

  const callOnce = () =>
    provider.generateStructured(
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `Suggest 3 substitutes for "${ex.name_en}".` },
      ],
      {
        model: MODEL,
        schema: ExerciseAlternativesResponseSchema,
        schemaName: 'ExerciseAlternatives',
        maxOutputTokens: 800,
        temperature: 0.5,
      },
    );

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

  // Resolve each suggestion to a real exercise row when possible.
  const enriched = await Promise.all(
    result.data.alternatives.map(async (alt) => ({
      ...alt,
      matched_exercise_id: await resolveByName(admin, alt.name, ex.muscle_group),
    })),
  );

  await incrementUsage(admin, userId, FEATURE);
  await logAICall(admin, {
    userId,
    feature: FEATURE,
    model: MODEL,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    status: 'success',
  });

  return json(200, { alternatives: enriched });
});

async function resolveByName(
  admin: Admin,
  name: string,
  muscleGroup: string,
): Promise<string | null> {
  const { data } = await admin
    .from('exercises')
    .select('id')
    .or(`name_en.ilike.${name},name_fr.ilike.${name},name_ar.ilike.${name}`)
    .eq('is_custom', false)
    .eq('muscle_group', muscleGroup.toLowerCase())
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
