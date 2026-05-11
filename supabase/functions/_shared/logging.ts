// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateCostUsd } from '../../../lib/llm/models.ts';

export interface CallLogInput {
  userId: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  status: 'success' | 'error';
  errorCode?: string;
}

export async function logAICall(admin: SupabaseClient, input: CallLogInput): Promise<void> {
  // Best-effort: never throw. A logging failure (FK violation, RLS, network) must
  // not poison the actual user-facing request.
  try {
    const cost = estimateCostUsd(input.model, input.inputTokens, input.outputTokens);
    const { error } = await admin.from('ai_call_logs').insert({
      user_id: input.userId,
      feature: input.feature,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cost_usd_estimate: cost,
      status: input.status,
      error_code: input.errorCode ?? null,
    });
    if (error) console.error('[logAICall]', error.message);
  } catch (e) {
    console.error('[logAICall] threw:', (e as Error).message);
  }
}
