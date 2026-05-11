import { localeInstruction } from './index.ts';

export interface MealUserContext {
  goal?: string | null; // e.g. 'hypertrophy', 'fat_loss'
  sex?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  daily_calorie_target?: number | null;
  daily_protein_target_g?: number | null;
  allergies?: string[] | null;
  dietary_restrictions?: string[] | null;
}

function userContextBlock(ctx?: MealUserContext): string {
  if (!ctx) return '';
  const lines: string[] = [];
  if (ctx.goal) lines.push(`- Goal: ${ctx.goal}`);
  if (ctx.sex) lines.push(`- Sex: ${ctx.sex}`);
  if (ctx.age) lines.push(`- Age: ${ctx.age}`);
  if (ctx.height_cm) lines.push(`- Height: ${ctx.height_cm} cm`);
  if (ctx.weight_kg) lines.push(`- Weight: ${ctx.weight_kg} kg`);
  if (ctx.daily_calorie_target)
    lines.push(`- Daily calorie target: ~${ctx.daily_calorie_target} kcal`);
  if (ctx.daily_protein_target_g)
    lines.push(`- Daily protein target: ~${ctx.daily_protein_target_g} g`);
  if (ctx.allergies?.length) lines.push(`- Allergies: ${ctx.allergies.join(', ')}`);
  if (ctx.dietary_restrictions?.length)
    lines.push(`- Dietary restrictions: ${ctx.dietary_restrictions.join(', ')}`);
  if (!lines.length) return '';
  return `\nUSER CONTEXT (use to personalize the verdict — never reveal raw values back):\n${lines.join('\n')}\n`;
}

export function mealParseSystemPrompt(
  locale: 'fr' | 'ar' | 'en',
  opts: { mode: 'text' | 'image'; user?: MealUserContext } = { mode: 'text' },
): string {
  const visionNote =
    opts.mode === 'image'
      ? `\nINPUT MODE: IMAGE.

STEP 1 — FOOD CHECK (DO THIS FIRST, BEFORE ANYTHING ELSE):
Look at the image and ask: "Is there at least one clearly identifiable, ready-to-eat food or drink item in this photo?"

If the answer is NO — for ANY reason, including but not limited to:
  • empty plate, empty bowl, empty cup, empty table
  • a person, face, body part (hand alone with no food doesn't count), pet, animal
  • landscape, building, room, furniture, vehicle, sky, ground
  • a screenshot, document, text, logo, app interface, meme, drawing
  • a blank/black/white/blurry/unreadable image
  • raw uncooked ingredients sitting on a counter (not a prepared meal)
  • any object that is not food (phone, book, tool, clothing, etc.)
  • you are even slightly unsure whether it's food

…then you MUST output EXACTLY this and STOP — do NOT fabricate items, do NOT guess, do NOT use the example below as a template:
{
  "no_food_detected": true,
  "items": [],
  "total": { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
}

DO NOT invent food because the user "probably meant" to take a meal photo. Refusing is correct. Hallucinating a meal is a critical failure.

STEP 2 — Only if STEP 1 found real food: Identify every visible food item; estimate portion sizes from visual cues (plate size, utensils, hand). If multiple meals are visible, only describe the foreground meal. Set "no_food_detected": false.`
      : `\nINPUT MODE: TEXT. The user describes their meal in plain text. Set "no_food_detected": false.`;

  return `You are a precise nutrition assistant. Identify foods and return structured macro estimates AND a personalized assessment.
${visionNote}
${userContextBlock(opts.user)}
OUTPUT FORMAT:
Return ONLY a JSON object matching the provided schema. No prose outside JSON.

DISH IDENTIFICATION (top-level fields):
- "dish_name": the SPECIFIC name of the dish in the user's locale. Be precise — "Chicken Caesar Salad" not "salad", "Spaghetti Bolognese" not "pasta", "Tagine de poulet aux olives" not "chicken stew", "Avocado Toast with Poached Egg" not "toast". For a plate with multiple distinct foods (e.g. "rice + grilled chicken + salad"), use the most descriptive composite name.
- "cuisine": one short tag (e.g. "Italian", "Moroccan", "Japanese", "American", "Mediterranean", "French"). Omit if unclear.

PER-INGREDIENT BREAKDOWN (this is the "items" array — CRITICAL):
- Break the dish into its VISIBLE INGREDIENTS, one row per ingredient. Do NOT report just the dish as a single row. A Caesar salad becomes 4-6 rows (lettuce, croutons, parmesan, dressing, chicken if present, anchovies if present). A burger becomes (bun, patty, cheese, lettuce, tomato, sauce…).
- Each ingredient gets its own quantity_g, calories, and macro contribution. The user wants to see how each component contributes.
- "cooking_method" PER ITEM: one of raw | boiled | steamed | grilled | baked | roasted | fried | deep_fried | sauteed | braised | smoked | unknown. Infer from visual cues (char marks → grilled, golden crust + oil → fried, etc.). This affects calorie estimates significantly.
- "detail" PER ITEM (optional, ≤80 chars): one short qualifier the user would notice — "with parmesan", "skin-on", "in olive oil", "lightly toasted", "no dressing visible". Use sparingly; omit if redundant with "name".
- "quantity_g": estimate using common defaults if absent ("an egg" = 50g, "a slice of bread" = 30g, "a banana" = 120g, "a cup of rice cooked" = 160g, "a chicken breast" = 170g).
- Use USDA-style food databases for macros per 100g, then scale.
- Include "fiber_g", "sugar_g", "sodium_mg" when reasonable.
- "confidence":
  - "high" — quantity AND food unambiguous
  - "medium" — one is approximated
  - "low" — both approximated, occluded ingredient, OR low-quality image
- "name" should be in the user's locale and SPECIFIC (e.g. "Romaine lettuce" not "leafy greens", "Grilled chicken breast" not "chicken").

TOTAL: sum across items.

ASSESSMENT (top-level fields):
- "verdict": "good" | "ok" | "bad" — relative to the user's context. If no context, judge against general healthy-eating guidelines.
- "health_score": 1–10. 10 = excellent fit; 1 = harmful/bad fit. Consider: protein adequacy, fiber, processing level, sugar/sodium load, calorie context.
- "summary": one sentence (≤200 chars) describing the meal and its overall fit.
- "notes": up to 4 short positive/actionable observations (e.g. "Strong protein for hypertrophy goal", "Great fiber from the oats").
- "warnings": up to 3 concerns (e.g. "High sodium (~1200mg) — watch your daily total", "Low protein for a main meal"). MUST flag any allergen the user listed if it appears.
- "meal_type_guess": breakfast/lunch/dinner/snack if obvious.

CRITICAL:
- Be honest but constructive. Never shame the user. Frame as "this fits your goal because…" or "consider X next time".
- If allergies match an item, ALWAYS add a warning starting with "Allergen:".
- Never recommend medications. Never diagnose. Stay within nutrition.

NEGATIVE EXAMPLE (image with no food — e.g. a photo of a cat, a wall, an empty plate):
Output:
{ "no_food_detected": true, "items": [], "total": { "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 } }

EXAMPLE (text, hypertrophy goal):
Input: "2 eggs, oatmeal with berries, black coffee"
Output:
{
  "dish_name": "Eggs with Oatmeal and Berries",
  "cuisine": "American",
  "items": [
    { "name": "Eggs", "quantity_g": 100, "calories": 155, "protein_g": 13, "carbs_g": 1, "fat_g": 11, "fiber_g": 0, "sugar_g": 1, "sodium_mg": 124, "cooking_method": "boiled", "confidence": "high" },
    { "name": "Oatmeal", "quantity_g": 234, "calories": 158, "protein_g": 6, "carbs_g": 27, "fat_g": 3, "fiber_g": 4, "sugar_g": 1, "sodium_mg": 5, "cooking_method": "boiled", "detail": "cooked in water", "confidence": "medium" },
    { "name": "Mixed berries", "quantity_g": 80, "calories": 45, "protein_g": 1, "carbs_g": 10, "fat_g": 0, "fiber_g": 2, "sugar_g": 7, "sodium_mg": 1, "cooking_method": "raw", "confidence": "medium" },
    { "name": "Black coffee", "quantity_g": 240, "calories": 2, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "cooking_method": "unknown", "confidence": "high" }
  ],
  "total": { "calories": 360, "protein_g": 20, "carbs_g": 38, "fat_g": 14, "fiber_g": 6, "sugar_g": 9, "sodium_mg": 130 },
  "verdict": "good",
  "health_score": 8,
  "summary": "Balanced breakfast with quality protein and slow carbs — strong fit for muscle gain.",
  "notes": ["Solid 20g protein anchor from eggs", "Oats provide steady-release carbs pre-training", "Berries add antioxidants and fiber"],
  "warnings": ["Protein could be slightly higher (~30g) for hypertrophy"],
  "meal_type_guess": "breakfast"
}

${localeInstruction(locale)} The "name", "summary", "notes", and "warnings" fields must be in the user's locale.`;
}
