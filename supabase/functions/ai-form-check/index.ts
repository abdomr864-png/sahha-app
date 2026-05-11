// Vision-based form analysis on 4–6 frames extracted client-side from a video.
// POST /functions/v1/ai-form-check  { exercise_id, video_url, frame_urls[], locale }

import { authenticate } from '../_shared/supabase.ts';
import { checkEntitlement, incrementUsage, isOverHardCap } from '../_shared/entitlement.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import { FormCheckRequestSchema, FormFeedbackSchema } from '../../../lib/llm/types.ts';
import { formCheckSystemPrompt } from '../../../lib/llm/prompts/form-check.ts';
import { MODELS } from '../../../lib/llm/models.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const FEATURE = 'ai_form_check';
const MODEL = MODELS.formCheck;

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  // === DEV MODE: AUTH BYPASS ===
  // Mirrors ai-meal-parse: accept anon-key requests by deriving userId from the
  // signed storage URL. Re-enable strict auth once the sign-in flow is fixed.
  let userId: string | null = null;
  let isBypassed = false;
  const admin = createAdminClient();
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const auth = await authenticate(req);
    if (!(auth instanceof Response)) {
      userId = auth.userId;
    } else {
      console.log('[ai-form-check] auth failed, continuing in DEV bypass mode');
      isBypassed = true;
    }
  } else {
    console.log('[ai-form-check] no auth header, DEV bypass mode');
    isBypassed = true;
  }

  let parsed;
  try {
    parsed = FormCheckRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  if (!userId) {
    const m = parsed.video_url.match(/\/form-checks\/([0-9a-fA-F-]{36})\//);
    if (m) userId = m[1];
    else userId = '00000000-0000-0000-0000-000000000000';
  }

  // Strict ownership check only when we have a real session userId.
  if (!isBypassed) {
    const allOwned =
      parsed.frame_urls.every((u) => u.includes(`/form-checks/${userId}/`)) &&
      parsed.video_url.includes(`/form-checks/${userId}/`);
    if (!allOwned) return json(400, { error: 'invalid_video' });

    if (await isOverHardCap(admin, userId)) return json(429, { error: 'quota_exceeded' });
    // Encode the spec's "1/week" via a 7-day window.
    const ent = await checkEntitlement(admin, userId, FEATURE, 7);
    if (!ent.allowed) {
      return json(429, {
        error: ent.reason === 'premium_only' ? 'entitlement_required' : 'rate_limited',
      });
    }
  }

  // Resolve exercise name for the prompt.
  const { data: exercise } = await admin
    .from('exercises')
    .select('name_en, name_fr, name_ar')
    .eq('id', parsed.exercise_id)
    .maybeSingle();
  const exerciseName: string = exercise
    ? ((parsed.locale === 'fr'
        ? (exercise as any).name_fr
        : parsed.locale === 'ar'
          ? (exercise as any).name_ar
          : (exercise as any).name_en) ?? (exercise as any).name_en)
    : 'unknown exercise';

  const provider = getOpenAI();
  const messages = [
    {
      role: 'system' as const,
      content: formCheckSystemPrompt({ locale: parsed.locale, exerciseName }),
    },
    {
      role: 'user' as const,
      content: `Analyze the form in these ${parsed.frame_urls.length} frames of a "${exerciseName}".`,
    },
  ];

  let result;
  try {
    result = await provider.generateVision(messages, {
      model: MODEL,
      schema: FormFeedbackSchema,
      schemaName: 'FormFeedback',
      imageUrls: parsed.frame_urls,
      maxOutputTokens: 1500,
      temperature: 0.3,
    });
  } catch (e) {
    const msg = (e as Error).message ?? '';
    let code: string = 'provider_error';
    if (msg.includes('parse') || msg.includes('schema')) code = 'invalid_response';
    else if (msg.includes('safety') || msg.includes('content')) code = 'unsafe_content';
    if (!isBypassed) {
      await logAICall(admin, {
        userId,
        feature: FEATURE,
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        status: 'error',
        errorCode: code,
      });
    }
    return json(502, { error: code });
  }

  // Persist into ai_form_checks (skip in bypass — dummy userId fails FK).
  let rowId: string | null = null;
  if (!isBypassed) {
    const { data: row, error } = await admin
      .from('ai_form_checks')
      .insert({
        user_id: userId,
        exercise_id: parsed.exercise_id,
        video_url: parsed.video_url,
        feedback: JSON.stringify(result.data),
      })
      .select('id')
      .single();
    if (error || !row) {
      return json(500, { error: 'provider_error' });
    }
    rowId = (row as any).id;

    await incrementUsage(admin, userId, FEATURE);
    await logAICall(admin, {
      userId,
      feature: FEATURE,
      model: MODEL,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      status: 'success',
    });
  }

  return json(200, { form_check_id: rowId, feedback: result.data });
});
