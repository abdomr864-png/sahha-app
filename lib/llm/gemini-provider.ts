// Google Gemini implementation of LLMProvider (REST, no SDK).
//
// IMPORTANT: imported by Deno Edge Functions only. Uses the Generative Language
// REST API (generativelanguage.googleapis.com) with an AI Studio API key passed
// as the `key` query param — so it has no npm/SDK dependency and runs cleanly in
// Deno. A drop-in alternative to OpenAIProvider behind the same LLMProvider
// interface; selection happens in _shared/openai.ts via the GEMINI_API_KEY env.

import type { LLMProvider } from './provider.ts';
import type {
  LLMChatOptions,
  LLMMessage,
  LLMStreamChunk,
  LLMStructuredOptions,
  LLMStructuredResult,
  LLMVisionOptions,
} from './types.ts';

interface GeminiConfig {
  apiKey: string;
  /** Override the model every call maps to. Defaults to gemini-2.5-flash. */
  defaultModel?: string;
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// We map OpenAI-flavoured model ids (the names in MODELS) onto Gemini models so
// the call sites and MODELS map don't need to change. "2.5 Flash everywhere".
const MODEL_MAP: Record<string, string> = {
  'gpt-4o-mini': 'gemini-2.5-flash',
  'gpt-4o': 'gemini-2.5-flash',
};

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  private apiKey: string;
  private defaultModel: string;

  constructor(cfg: GeminiConfig) {
    if (!cfg.apiKey) throw new Error('GeminiProvider: missing apiKey');
    this.apiKey = cfg.apiKey;
    this.defaultModel = cfg.defaultModel ?? 'gemini-2.5-flash';
  }

  private model(requested: string): string {
    if (requested.startsWith('gemini')) return requested;
    return MODEL_MAP[requested] ?? this.defaultModel;
  }

  async *streamChat(messages: LLMMessage[], opts: LLMChatOptions): AsyncIterable<LLMStreamChunk> {
    const model = this.model(opts.model);
    const { systemInstruction, contents } = toGeminiContents(messages);
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
        // Disable extended "thinking" so first-token latency stays low and the
        // token budget isn't silently consumed by reasoning tokens.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const res = await fetch(
      `${API_BASE}/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts.signal,
      },
    );
    if (!res.ok || !res.body) {
      throw new Error(`gemini stream failed: ${res.status} ${await safeText(res)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are newline-delimited; each data line is a JSON object.
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch {
            continue;
          }
          const delta = obj?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p?.text ?? '')
            .join('');
          if (delta) yield { delta };
          if (obj?.usageMetadata) {
            usage = {
              inputTokens: obj.usageMetadata.promptTokenCount ?? 0,
              outputTokens: obj.usageMetadata.candidatesTokenCount ?? 0,
            };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { done: true, usage: usage ?? { inputTokens: 0, outputTokens: 0 } };
  }

  async generateStructured<T>(
    messages: LLMMessage[],
    opts: LLMStructuredOptions<T>,
  ): Promise<LLMStructuredResult<T>> {
    return this.callStructured(messages, opts, opts.temperature ?? 0.4);
  }

  async generateVision<T>(
    messages: LLMMessage[],
    opts: LLMVisionOptions<T>,
  ): Promise<LLMStructuredResult<T>> {
    // Gemini can't fetch arbitrary image URLs — it needs the bytes inline. Pull
    // each image server-side (the edge function can read the signed URL) and
    // attach as base64 inlineData parts on the final user turn.
    const inlineParts = await Promise.all(opts.imageUrls.map((u) => urlToInlinePart(u)));
    return this.callStructured(messages, opts, opts.temperature ?? 0.3, inlineParts);
  }

  private async callStructured<T>(
    messages: LLMMessage[],
    opts: LLMStructuredOptions<T>,
    temperature: number,
    extraUserParts: GeminiPart[] = [],
  ): Promise<LLMStructuredResult<T>> {
    const model = this.model(opts.model);
    const { systemInstruction, contents } = toGeminiContents(messages, extraUserParts);
    const rawSchema = opts.jsonSchema ?? buildJsonSchemaFromZod(opts.schema);
    const responseSchema = sanitizeForGemini(rawSchema);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature,
        ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
        responseMimeType: 'application/json',
        responseSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`gemini generateContent failed: ${res.status} ${await safeText(res)}`);
    }
    const data = await res.json();

    const candidate = data?.candidates?.[0];
    const finishReason: string | undefined = candidate?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('gemini response truncated at max_tokens — increase maxOutputTokens');
    }
    if (
      finishReason === 'SAFETY' ||
      finishReason === 'RECITATION' ||
      finishReason === 'BLOCKLIST'
    ) {
      throw new Error(`gemini blocked the response (${finishReason})`);
    }
    const text: string = candidate?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
    if (!text) throw new Error('gemini returned empty response');

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      const snippet = text.slice(0, 200).replace(/\s+/g, ' ');
      throw new Error(`gemini returned non-JSON response (len=${text.length}): ${snippet}`);
    }
    const parsed = opts.schema.parse(raw);
    return {
      data: parsed,
      usage: {
        inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Message + schema conversion helpers
// ---------------------------------------------------------------------------

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function toGeminiContents(
  messages: LLMMessage[],
  extraLastUserParts: GeminiPart[] = [],
): { systemInstruction?: { parts: { text: string }[] }; contents: any[] } {
  const systemTexts: string[] = [];
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemTexts.push(m.content);
      continue;
    }
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    });
  }
  // Attach images/extra parts to the last user turn (creating one if needed).
  if (extraLastUserParts.length) {
    const lastUser = [...contents].reverse().find((c) => c.role === 'user');
    if (lastUser) lastUser.parts.push(...extraLastUserParts);
    else contents.push({ role: 'user', parts: [...extraLastUserParts] });
  }
  const systemInstruction = systemTexts.length
    ? { parts: [{ text: systemTexts.join('\n\n') }] }
    : undefined;
  return { systemInstruction, contents };
}

async function urlToInlinePart(url: string): Promise<GeminiPart> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gemini image fetch failed: ${res.status} for ${url.slice(0, 80)}`);
  const mimeType = (res.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { inlineData: { mimeType, data: bytesToBase64(bytes) } };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // avoid arg-count limits on String.fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}

// Gemini's responseSchema is an OpenAPI subset that rejects `additionalProperties`
// (and a few other JSON-Schema-isms). Strip what it doesn't accept, recursively.
function sanitizeForGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: any): any => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === 'additionalProperties' || k === '$schema') continue;
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  return walk(schema);
}

// Minimal Zod → JSON-schema converter. Mirrors the one in openai-provider.ts so
// the two providers stay independent (no cross-import of the OpenAI SDK module).
function buildJsonSchemaFromZod(z: any): Record<string, unknown> {
  return zodToJson(z);
}

function zodToJson(node: any): Record<string, unknown> {
  const def = node?._def;
  if (!def) return {};
  switch (def.typeName) {
    case 'ZodString':
      return { type: 'string' };
    case 'ZodNumber':
      return { type: 'number' };
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodLiteral':
      return { type: typeof def.value === 'number' ? 'number' : 'string', enum: [def.value] };
    case 'ZodEnum':
      return { type: 'string', enum: def.values };
    case 'ZodOptional':
    case 'ZodNullable':
      return zodToJson(def.innerType);
    case 'ZodArray':
      return { type: 'array', items: zodToJson(def.type) };
    case 'ZodUnion':
      return { anyOf: def.options.map(zodToJson) };
    case 'ZodRecord':
      return { type: 'object', additionalProperties: zodToJson(def.valueType) };
    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape) as [string, any][]) {
        properties[k] = zodToJson(v);
        if (v?._def?.typeName !== 'ZodOptional' && v?._def?.typeName !== 'ZodDefault') {
          required.push(k);
        }
      }
      return { type: 'object', properties, required, additionalProperties: false };
    }
    default:
      return {};
  }
}
