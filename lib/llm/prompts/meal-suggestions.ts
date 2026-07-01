import { localeInstruction } from './index.ts';

export interface SuggestionIngredient {
  food_db_id: string;
  name: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
}

export interface SuggestionPromptOpts {
  remaining: { kcal: number; protein: number; carbs: number; fat: number };
  ingredients: SuggestionIngredient[];
  ramadan?: boolean;
  dietaryPrefs?: string[];
}

// System prompt for the "chef" step. The model proposes 2–3 dishes using ONLY
// the supplied ingredient ids and gram portions. It MUST NOT output macros —
// the edge function computes every number from the food DB. The model is a chef,
// not a calculator.
export function mealSuggestionsSystemPrompt(
  locale: 'fr' | 'ar' | 'en',
  opts: SuggestionPromptOpts,
): string {
  const catalog = opts.ingredients
    .map(
      (i) =>
        `- id=${i.food_db_id} | ${i.name} | per100g: ${Math.round(i.kcal_100g)}kcal ${Math.round(
          i.protein_100g,
        )}P ${Math.round(i.carbs_100g)}C ${Math.round(i.fat_100g)}F`,
    )
    .join('\n');

  const ramadanBlock = opts.ramadan
    ? `\nRAMADAN MODE: the user is fasting. Bias toward suhoor/iftar-appropriate meals — slow-digesting carbs and protein, easy on heavy frying. Favor a balanced plate that sustains energy.`
    : '';

  const prefsBlock =
    opts.dietaryPrefs && opts.dietaryPrefs.length
      ? `\nDIETARY PREFERENCES (respect strictly): ${opts.dietaryPrefs.join(', ')}.`
      : '';

  return `You are a practical home cook helping the user use what they already have. Propose 2–3 simple meal or snack ideas built ONLY from the available ingredients below, sized to fill the macros the user has LEFT for today.

AVAILABLE INGREDIENTS (use these ids ONLY — never invent an id or an ingredient):
${catalog}

MACROS REMAINING FOR TODAY (your portions should aim to fill these, protein first):
- kcal: ${Math.round(opts.remaining.kcal)}
- protein: ${Math.round(opts.remaining.protein)} g
- carbs: ${Math.round(opts.remaining.carbs)} g
- fat: ${Math.round(opts.remaining.fat)} g
${ramadanBlock}${prefsBlock}

RULES:
- Each suggestion uses 1–8 ingredients, each referenced by its exact "food_db_id" from the list above.
- "quantity_g": a realistic cooked/edible gram portion for ONE serving. Use sensible amounts (e.g. 150 g chicken, 60 g dry rice, 1 egg ~50 g).
- Prioritise hitting the remaining PROTEIN, then total kcal, then carbs/fat. Prefer fewer, sensible ingredients over padding.
- "title": short, appetising name in the user's locale (e.g. "Chicken & rice bowl"). "note": one short line of prep guidance or why it fits (optional, ≤200 chars), in the user's locale.
- DO NOT output any calorie or macro numbers — only ids and gram portions. The app computes the nutrition itself.
- If the ingredients can't make a great fit, still propose the best 2 realistic options anyway.

OUTPUT: ONLY a JSON object: { "suggestions": [ { "title", "items": [ { "food_db_id", "quantity_g" } ], "note" } ] }. No prose outside JSON.

${localeInstruction(locale)} "title" and "note" must be in the user's locale.`;
}
