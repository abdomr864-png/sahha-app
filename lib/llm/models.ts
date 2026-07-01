// Model constants per use-case. Never inline a model name at a call site.
// gpt-4o-mini is cost-efficient for text/structured output.
// gpt-4o has the vision capability we need for form-check.

export const MODELS = {
  // Using -mini for chat: matches the model the other AI features use
  // (program-gen, meal-parse, etc.), which avoids a class of "no access to
  // gpt-4o" failures on accounts that haven't been granted that model.
  chat: 'gpt-4o-mini',
  programGen: 'gpt-4o-mini',
  programAdjust: 'gpt-4o-mini',
  mealParse: 'gpt-4o-mini',
  // Photo meal analysis. gpt-4o-mini is multimodal and reads food photos well
  // enough for macro estimation, costs ~20x less than gpt-4o, and avoids the
  // "no access to gpt-4o" failures that were silently rejecting real meals.
  mealVision: 'gpt-4o-mini',
  formCheck: 'gpt-4o',
  // Vision is needed for equipment ID; -mini's visual reasoning on uncommon
  // equipment isn't reliable enough. Cost-bounded by the per-feature daily limit.
  equipmentScan: 'gpt-4o',
  workoutGen: 'gpt-4o-mini',
  exerciseAlts: 'gpt-4o-mini',
  // "What can I eat?" — pantry ingredient detection (vision) and the chef that
  // proposes dishes from confirmed ingredients. -mini is multimodal, cheap, and
  // reads pantry/fridge photos well enough; macros are computed in code anyway.
  pantryScan: 'gpt-4o-mini',
  mealSuggest: 'gpt-4o-mini',
} as const;

export type ModelKey = keyof typeof MODELS;

// USD per 1K tokens (input, output) — used only for the cost-estimate column
// in ai_call_logs. Keep in sync with OpenAI pricing; off-by-2x doesn't break
// the abuse-detection use case.
export const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 0, output: 0 };
  return (inputTokens / 1000) * p.input + (outputTokens / 1000) * p.output;
}

// Hard ceiling across all features per user per day.
export const HARD_DAILY_CAP = 100;

// Token caps applied to chat input/output.
export const CHAT_INPUT_TOKEN_CAP = 4000;
export const CHAT_OUTPUT_TOKEN_CAP = 1500;
