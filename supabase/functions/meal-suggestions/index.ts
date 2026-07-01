// "What can I eat?" step 2 — given the user's CONFIRMED pantry ingredients and
// the macros they have left today, propose 2–3 meals that best fill the gap.
// POST /functions/v1/meal-suggestions
//   { confirmed_food_db_ids[], remaining_macros, locale, ramadan_mode?, dietary_prefs? }
//
// RELIABILITY: the model proposes dishes + gram portions ONLY. This function
// computes every macro from the food DB and ranks by a deterministic fit score.
// Any macro the model might emit is impossible to leak — the draft schema has no
// macro fields.

import { authenticate } from '../_shared/supabase.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import {
  MealSuggestionsRequestSchema,
  SuggestionDraftListSchema,
  type MealSuggestion,
  type SuggestionItem,
} from '../../../lib/llm/types.ts';
import {
  mealSuggestionsSystemPrompt,
  type SuggestionIngredient,
} from '../../../lib/llm/prompts/meal-suggestions.ts';
import {
  macrosForPortion,
  sumMacros,
  roundMacros,
  fitScore,
  fillPct,
  biggestShortfall,
  type FoodMacroRow,
  type MacroSet,
} from '../../../lib/nutrition/macros.ts';
import { MODELS } from '../../../lib/llm/models.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

const FEATURE = 'pantry_scan';
const MODEL = MODELS.mealSuggest;
// Below this fit score even the best suggestion is a weak match — the client
// shows the graceful "here's the closest, add X to round it out" state.
const WEAK_FIT_THRESHOLD = 45;

interface DbFood extends FoodMacroRow {
  name: string;
  name_fr: string | null;
  name_ar: string | null;
}

function localizedName(f: DbFood, locale: 'fr' | 'ar' | 'en'): string {
  if (locale === 'fr') return f.name_fr || f.name;
  if (locale === 'ar') return f.name_ar || f.name;
  return f.name;
}

function per100(value: number, servingSize: number): number {
  const s = servingSize > 0 ? servingSize : 100;
  return (value / s) * 100;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  // === DEV MODE: AUTH BYPASS === (mirrors ai-meal-parse).
  let userId = '00000000-0000-0000-0000-000000000000';
  const authHeader = req.headers.get('authorization');
  const admin = createAdminClient();
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const auth = await authenticate(req);
    if (!(auth instanceof Response)) {
      userId = auth.userId;
    } else {
      console.log('[meal-suggestions] auth failed, continuing in DEV bypass mode');
    }
  } else {
    console.log('[meal-suggestions] no auth header, DEV bypass mode');
  }

  let parsed;
  try {
    parsed = MealSuggestionsRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  // Load the confirmed foods. These rows are the ONLY macro source.
  const { data: foodData, error: foodErr } = await admin
    .from('foods')
    .select('id, name, name_fr, name_ar, calories, protein_g, carbs_g, fat_g, serving_size_g')
    .in('id', parsed.confirmed_food_db_ids);
  if (foodErr) {
    console.error('[meal-suggestions] foods fetch failed:', foodErr.message);
    return json(502, { error: 'provider_error' });
  }
  const foods = (foodData ?? []) as DbFood[];
  if (foods.length === 0) return json(400, { error: 'insufficient_data' });
  const byId = new Map(foods.map((f) => [f.id, f]));

  const remaining: MacroSet = {
    kcal: parsed.remaining_macros.kcal,
    protein: parsed.remaining_macros.protein,
    carbs: parsed.remaining_macros.carbs,
    fat: parsed.remaining_macros.fat,
  };

  const ingredients: SuggestionIngredient[] = foods.map((f) => ({
    food_db_id: f.id,
    name: localizedName(f, parsed.locale),
    kcal_100g: per100(f.calories, f.serving_size_g),
    protein_100g: per100(f.protein_g, f.serving_size_g),
    carbs_100g: per100(f.carbs_g, f.serving_size_g),
    fat_100g: per100(f.fat_g, f.serving_size_g),
  }));

  const systemPrompt = mealSuggestionsSystemPrompt(parsed.locale, {
    remaining,
    ingredients,
    ramadan: parsed.ramadan_mode,
    dietaryPrefs: parsed.dietary_prefs,
  });
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: 'Suggest meals from these ingredients.' },
  ];

  const callOnce = () =>
    getOpenAI().generateStructured(messages, {
      model: MODEL,
      schema: SuggestionDraftListSchema,
      schemaName: 'MealSuggestions',
      maxOutputTokens: 2000,
    });

  let result;
  try {
    result = await callOnce();
  } catch (firstErr) {
    console.error('[meal-suggestions] provider call failed (1):', (firstErr as Error)?.message);
    try {
      result = await callOnce();
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
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

  // ---- Compute macros + fit in CODE for each draft suggestion ----
  const enriched: MealSuggestion[] = [];
  for (const draft of result.data.suggestions ?? []) {
    const items: SuggestionItem[] = [];
    for (const it of draft.items) {
      const food = byId.get(it.food_db_id);
      if (!food) continue; // model referenced an id outside the confirmed set — drop it
      const macros = macrosForPortion(food, it.quantity_g);
      items.push({
        food_db_id: food.id,
        name: localizedName(food, parsed.locale),
        quantity_g: Math.round(it.quantity_g),
        macros: roundMacros(macros),
      });
    }
    if (items.length === 0) continue;
    const total = sumMacros(items.map((i) => i.macros));
    enriched.push({
      title: draft.title,
      note: draft.note,
      items,
      macros: roundMacros(total),
      fit_score: fitScore(total, remaining),
      protein_fill_pct: fillPct(total.protein, remaining.protein),
      shortfall: biggestShortfall(total, remaining),
    });
  }

  // Rank by deterministic fit, best first; keep the top 3.
  enriched.sort((a, b) => b.fit_score - a.fit_score);
  const top = enriched.slice(0, 3);
  const bestIsWeak = top.length === 0 || top[0].fit_score < WEAK_FIT_THRESHOLD;

  await logAICall(admin, {
    userId,
    feature: FEATURE,
    model: MODEL,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    status: 'success',
  });

  return json(200, { suggestions: top, best_is_weak: bestIsWeak });
});
