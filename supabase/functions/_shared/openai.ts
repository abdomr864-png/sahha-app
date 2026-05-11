import { OpenAIProvider } from '../../../lib/llm/openai-provider.ts';

let cached: OpenAIProvider | null = null;

export function getOpenAI(): OpenAIProvider {
  if (cached) return cached;
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('missing_OPENAI_API_KEY');
  cached = new OpenAIProvider({
    apiKey,
    organization: Deno.env.get('OPENAI_ORG') ?? undefined,
  });
  return cached;
}
