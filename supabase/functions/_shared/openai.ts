import { OpenAIProvider } from '../../../lib/llm/openai-provider.ts';
import { GeminiProvider } from '../../../lib/llm/gemini-provider.ts';
import type { LLMProvider } from '../../../lib/llm/provider.ts';

let cached: LLMProvider | null = null;

/**
 * Resolve the active LLM provider. Selection is by env, checked once and cached:
 *  - GEMINI_API_KEY present → Gemini (Google AI Studio, REST).
 *  - else OPENAI_API_KEY    → OpenAI.
 * Both implement the same LLMProvider interface, so call sites don't change.
 */
export function getProvider(): LLMProvider {
  if (cached) return cached;
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) {
    cached = new GeminiProvider({ apiKey: geminiKey });
    return cached;
  }
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('missing_OPENAI_API_KEY');
  cached = new OpenAIProvider({
    apiKey,
    organization: Deno.env.get('OPENAI_ORG') ?? undefined,
  });
  return cached;
}

// Back-compat alias: existing functions import `getOpenAI`. It now returns
// whichever provider is configured (Gemini or OpenAI).
export const getOpenAI = getProvider;
