// "What can I eat?" step 1 — pantry/fridge photo(s) -> structured ingredient
// list, each mapped to a food-DB row in CODE (never by the model).
// POST /functions/v1/pantry-scan  { image_urls: string[], locale }
//
// Mirrors ai-meal-parse: dev-bypass auth, vision via the shared provider,
// best-effort logging. The model only names ingredients; this function resolves
// each name to foods.id and returns confidence so the confirm UI can edit.

import { authenticate } from '../_shared/supabase.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import {
  PantryScanRequestSchema,
  PantryVisionOutputSchema,
  type PantryScanItem,
} from '../../../lib/llm/types.ts';
import { pantryScanSystemPrompt } from '../../../lib/llm/prompts/pantry-scan.ts';
import { matchFood, type MatchableFood } from '../../../lib/nutrition/match.ts';
import { MODELS } from '../../../lib/llm/models.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

const FEATURE = 'pantry_scan';
const MODEL = MODELS.pantryScan;

interface FoodRow extends MatchableFood {
  id: string;
}

async function fetchFoodCatalog(admin: ReturnType<typeof createAdminClient>): Promise<FoodRow[]> {
  // The curated DB is small; pull it all and match in code. Include any other
  // foods rows too so manually-added foods can also resolve.
  const { data } = await admin
    .from('foods')
    .select('id, slug, name, name_fr, name_ar, aliases')
    .limit(2000);
  return (data ?? []) as FoodRow[];
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  // === DEV MODE: AUTH BYPASS === (mirrors ai-meal-parse; re-enable when auth is
  // restored end-to-end). Safe ONLY in dev — anyone with the URL can call it.
  let userId = '00000000-0000-0000-0000-000000000000';
  const authHeader = req.headers.get('authorization');
  const admin = createAdminClient();
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const auth = await authenticate(req);
    if (!(auth instanceof Response)) {
      userId = auth.userId;
    } else {
      console.log('[pantry-scan] auth failed, continuing in DEV bypass mode');
    }
  } else {
    console.log('[pantry-scan] no auth header, DEV bypass mode');
  }

  let parsed;
  try {
    parsed = PantryScanRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  const provider = getOpenAI();
  const systemPrompt = pantryScanSystemPrompt(parsed.locale);
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: 'List the food ingredients in these photos.' },
  ];

  const callOnce = () =>
    provider.generateVision(messages, {
      model: MODEL,
      schema: PantryVisionOutputSchema,
      schemaName: 'PantryVision',
      maxOutputTokens: 2000,
      imageUrls: parsed.image_urls,
    });

  let result;
  try {
    result = await callOnce();
  } catch (firstErr) {
    console.error('[pantry-scan] provider call failed (attempt 1):', (firstErr as Error)?.message);
    try {
      result = await callOnce();
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.error('[pantry-scan] provider call failed (attempt 2):', msg);
      const code = /truncat|parse|json|empty/i.test(msg) ? 'invalid_response' : 'provider_error';
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

  const detected = result.data.items ?? [];
  if (result.data.no_food_detected === true || detected.length === 0) {
    await logAICall(admin, {
      userId,
      feature: FEATURE,
      model: MODEL,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      status: 'error',
      errorCode: 'no_food_detected',
    });
    return json(422, { error: 'no_food_detected' });
  }

  // Map every detected name to a food-DB row IN CODE. Unmatched -> food_db_id null.
  const catalog = await fetchFoodCatalog(admin);
  const items: PantryScanItem[] = detected.map((d) => {
    const match = matchFood(d.name, catalog);
    return {
      name: d.name,
      food_db_id: match?.id ?? null,
      quantity: d.quantity ?? null,
      unit: d.unit ?? null,
      confidence: d.confidence,
    };
  });

  await logAICall(admin, {
    userId,
    feature: FEATURE,
    model: MODEL,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    status: 'success',
  });

  return json(200, { items });
});
