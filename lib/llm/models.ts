// Model constants per use-case. Never inline a model name at a call site.
// gpt-4o-mini is cost-efficient for text/structured output.
// gpt-4o has the vision capability we need for form-check.

export const MODELS = {
  // Coach chat upgraded from -mini to gpt-4o for richer, more grounded advice
  // off the user's real training/recovery context. Token caps + per-user daily
  // limits keep the cost bounded.
  chat: 'gpt-4o',
  programGen: 'gpt-4o-mini',
  programAdjust: 'gpt-4o-mini',
  mealParse: 'gpt-4o-mini',
  formCheck: 'gpt-4o',
  // Vision is needed for equipment ID; -mini's visual reasoning on uncommon
  // equipment isn't reliable enough. Cost-bounded by the per-feature daily limit.
  equipmentScan: 'gpt-4o',
  workoutGen: 'gpt-4o-mini',
  exerciseAlts: 'gpt-4o-mini',
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
