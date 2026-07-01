// Pure, dependency-free macro math. Imported by BOTH the Deno edge functions
// (meal-suggestions computes macros server-side) and RN client code. No runtime
// deps so it loads in either runtime.
//
// RELIABILITY CONTRACT: the LLM never produces the numbers shown to the user.
// It proposes dishes + portion sizes; THIS module computes every macro from the
// food DB rows, and ranks suggestions by a deterministic fit score.

export interface MacroSet {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** The subset of a `foods` row needed to scale macros. Macros are per `serving_size_g`. */
export interface FoodMacroRow {
  id: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  serving_size_g: number;
}

export function emptyMacros(): MacroSet {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
}

/**
 * Macros for `quantityG` grams of a food, scaled from its per-serving values.
 * The suggestion prompt is instructed to always return grams; if a non-gram
 * quantity slips through we still treat it as grams (better than dropping it).
 */
export function macrosForPortion(food: FoodMacroRow, quantityG: number): MacroSet {
  const per = food.serving_size_g > 0 ? food.serving_size_g : 100;
  const k = (quantityG || 0) / per;
  return {
    kcal: food.calories * k,
    protein: food.protein_g * k,
    carbs: food.carbs_g * k,
    fat: food.fat_g * k,
  };
}

export function sumMacros(list: MacroSet[]): MacroSet {
  return list.reduce<MacroSet>(
    (s, m) => ({
      kcal: s.kcal + m.kcal,
      protein: s.protein + m.protein,
      carbs: s.carbs + m.carbs,
      fat: s.fat + m.fat,
    }),
    emptyMacros(),
  );
}

export function roundMacros(m: MacroSet): MacroSet {
  return {
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein),
    carbs: Math.round(m.carbs),
    fat: Math.round(m.fat),
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// A typical single-meal "worth" of each macro — used to penalize overshooting a
// macro the user has ALREADY met for the day (so suggestions don't pile onto a
// satisfied macro). Reference only; never shown.
const MEAL_REF: MacroSet = { kcal: 600, protein: 40, carbs: 75, fat: 30 };

// Protein is weighted highest (the spec's ranking priority), then kcal, then
// carbs/fat. Weights sum to 1 so the score lands in 0..1 before ×100.
const WEIGHTS = { protein: 0.45, kcal: 0.3, carbs: 0.15, fat: 0.1 } as const;

function macroScore(mealMacro: number, gap: number, ref: number): number {
  if (gap > 0) {
    // Best when the meal lands on the gap; both under- and over-shoot cost.
    return clamp01(1 - Math.abs(gap - mealMacro) / gap);
  }
  // Macro already satisfied for the day: adding nothing is ideal, adding a full
  // extra meal's worth scores 0.
  if (mealMacro <= 0) return 1;
  return clamp01(1 - mealMacro / ref);
}

/**
 * Deterministic 0..100 fit of a meal's macros to the remaining daily gap.
 * Higher = fills the gap better. This is the ONLY thing suggestions are ranked by.
 */
export function fitScore(meal: MacroSet, remaining: MacroSet): number {
  const p = macroScore(meal.protein, remaining.protein, MEAL_REF.protein);
  const k = macroScore(meal.kcal, remaining.kcal, MEAL_REF.kcal);
  const c = macroScore(meal.carbs, remaining.carbs, MEAL_REF.carbs);
  const f = macroScore(meal.fat, remaining.fat, MEAL_REF.fat);
  const score = p * WEIGHTS.protein + k * WEIGHTS.kcal + c * WEIGHTS.carbs + f * WEIGHTS.fat;
  return Math.round(score * 100);
}

/** Percentage of the remaining gap for one macro this meal covers (0..100). */
export function fillPct(mealMacro: number, remainingMacro: number): number {
  if (remainingMacro <= 0) return 100; // already covered for the day
  return Math.round(clamp01(mealMacro / remainingMacro) * 100);
}

export type MacroKey = 'protein' | 'carbs' | 'fat' | 'kcal';

/**
 * Which macro the user still most needs that this meal under-delivers — used for
 * the graceful "add a carb source to round this out" note. Returns null when the
 * meal covers everything reasonably well.
 */
export function biggestShortfall(meal: MacroSet, remaining: MacroSet): MacroKey | null {
  const macros: { key: MacroKey; meal: number; rem: number }[] = [
    { key: 'protein', meal: meal.protein, rem: remaining.protein },
    { key: 'carbs', meal: meal.carbs, rem: remaining.carbs },
    { key: 'fat', meal: meal.fat, rem: remaining.fat },
    { key: 'kcal', meal: meal.kcal, rem: remaining.kcal },
  ];
  let worst: MacroKey | null = null;
  let worstCoverage = 0.7; // only flag macros covered < 70% of what's left
  for (const m of macros) {
    if (m.rem <= 0) continue; // not needed
    const coverage = clamp01(m.meal / m.rem);
    if (coverage < worstCoverage) {
      worstCoverage = coverage;
      worst = m.key;
    }
  }
  return worst;
}
