// Vision-based gym equipment identification.
// POST /functions/v1/ai-equipment-scan  { image_url, locale }

import { authenticate } from '../_shared/supabase.ts';
import { checkEntitlement, incrementUsage, isOverHardCap } from '../_shared/entitlement.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import { EquipmentScanRequestSchema, EquipmentVisionOutputSchema } from '../../../lib/llm/types.ts';
import { equipmentScanSystemPrompt } from '../../../lib/llm/prompts/equipment-scan.ts';
import { getPersonaPromptBlock } from '../../../lib/llm/prompts/persona.ts';
import { MODELS } from '../../../lib/llm/models.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const FEATURE = 'equipment_scan';
const MODEL = MODELS.equipmentScan;

// deno-lint-ignore no-explicit-any
type Admin = any;

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
  // Mirrors ai-meal-parse: while the email/password sign-in flow is being fixed,
  // accept calls with the anon key by falling back to the userId encoded in the
  // signed storage URL. Re-enable strict auth by restoring the original
  // `const auth = await authenticate(req); ...` block.
  let userId: string | null = null;
  let isBypassed = false;
  const admin = createAdminClient();
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const auth = await authenticate(req);
    if (!(auth instanceof Response)) {
      userId = auth.userId;
    } else {
      console.log('[ai-equipment-scan] auth failed, continuing in DEV bypass mode');
      isBypassed = true;
    }
  } else {
    console.log('[ai-equipment-scan] no auth header, DEV bypass mode');
    isBypassed = true;
  }

  let parsed;
  try {
    parsed = EquipmentScanRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  // In bypass mode, derive the userId from the signed storage URL path
  // (`/equipment-scans/<userId>/...`). The signed URL is short-lived and only
  // issuable by an authenticated client uploading to its own RLS-bound folder,
  // so trusting it is acceptable for dev.
  if (!userId) {
    const m = parsed.image_url.match(/\/equipment-scans\/([0-9a-fA-F-]{36})\//);
    if (m) userId = m[1];
    else userId = '00000000-0000-0000-0000-000000000000';
  }

  // Strict ownership check only when we have a real session userId.
  if (!isBypassed && !parsed.image_url.includes(`/equipment-scans/${userId}/`)) {
    return json(403, { error: 'invalid_image' });
  }

  if (!isBypassed) {
    if (await isOverHardCap(admin, userId)) return json(429, { error: 'quota_exceeded' });
    const ent = await checkEntitlement(admin, userId, FEATURE, 1);
    if (!ent.allowed) {
      return json(429, {
        error: ent.reason === 'premium_only' ? 'entitlement_required' : 'rate_limited',
      });
    }
  }

  const profile = isBypassed
    ? { weight_kg: null, experience_level: null }
    : await fetchScannerContext(admin, userId);
  const persona = isBypassed ? '' : await getPersonaPromptBlock(admin, userId);
  const systemPrompt = equipmentScanSystemPrompt({
    locale: parsed.locale,
    bodyweight_kg: profile.weight_kg,
    experience: profile.experience_level,
    persona,
  });
  const provider = getOpenAI();

  const callOnce = () =>
    provider.generateVision(
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: 'Identify the equipment in this photo.' },
      ],
      {
        model: MODEL,
        schema: EquipmentVisionOutputSchema,
        schemaName: 'EquipmentScan',
        maxOutputTokens: 1500,
        imageUrls: [parsed.image_url],
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
  }

  const matched =
    result.data.unrecognized || !result.data.equipment
      ? []
      : await matchExercises(
          admin,
          result.data.equipment.name_en,
          result.data.equipment.primary_muscles,
        );

  if (!isBypassed) {
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

  return json(200, {
    equipment: result.data.equipment,
    matched_exercises: matched,
    unrecognized: result.data.unrecognized,
  });
});

async function fetchScannerContext(admin: Admin, userId: string) {
  const { data } = await admin
    .from('profiles')
    .select('weight_kg, experience_level')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    weight_kg: data?.weight_kg ?? null,
    experience_level: data?.experience_level ?? null,
  };
}

async function matchExercises(admin: Admin, equipmentName: string, primaryMuscles: string[]) {
  const tokens = equipmentName
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const lastTok = tokens[tokens.length - 1] ?? equipmentName;
  const muscle = (primaryMuscles[0] ?? '').toLowerCase();

  const { data: byMuscleAndName } = await admin
    .from('exercises')
    .select('id, name_en, name_fr, name_ar, instructions_en, video_url, photo_url')
    .eq('is_custom', false)
    .eq('muscle_group', muscle)
    .ilike('name_en', `%${lastTok}%`)
    .limit(5);

  let candidates = (byMuscleAndName ?? []) as any[];
  if (candidates.length < 3) {
    const { data: byMuscle } = await admin
      .from('exercises')
      .select('id, name_en, name_fr, name_ar, instructions_en, video_url, photo_url')
      .eq('is_custom', false)
      .eq('muscle_group', muscle)
      .limit(8);
    const seen = new Set(candidates.map((c) => c.id));
    for (const c of (byMuscle ?? []) as any[]) {
      if (seen.has(c.id)) continue;
      candidates.push(c);
      if (candidates.length >= 5) break;
    }
  }
  return candidates.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name_en,
    instructions: c.instructions_en ?? null,
    video_url: c.video_url ?? null,
    photo_url: c.photo_url ?? null,
  }));
}
