// OpenAI implementation of LLMProvider.
//
// IMPORTANT: This file is imported by Deno Edge Functions only. Never import
// it from React Native code — the OpenAI SDK is server-only and the API key
// is held in Supabase secrets.
//
// Deno imports the SDK from esm.sh; Node would resolve from node_modules. The
// dynamic import below works in both runtimes.

// RN never imports this file; only Deno Edge Functions do. Use the esm.sh URL
// directly so we don't depend on a per-function import map.
// @ts-ignore — Deno-only URL import.
import OpenAI from 'https://esm.sh/openai@4.73.0';

import type { LLMProvider } from './provider.ts';
import type {
  LLMChatOptions,
  LLMMessage,
  LLMStreamChunk,
  LLMStructuredOptions,
  LLMStructuredResult,
  LLMVisionOptions,
} from './types.ts';

interface OpenAIConfig {
  apiKey: string;
  organization?: string;
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  private client: any;

  constructor(cfg: OpenAIConfig) {
    if (!cfg.apiKey) throw new Error('OpenAIProvider: missing apiKey');
    this.client = new (OpenAI as any)({
      apiKey: cfg.apiKey,
      organization: cfg.organization,
    });
  }

  async *streamChat(messages: LLMMessage[], opts: LLMChatOptions): AsyncIterable<LLMStreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxOutputTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream as any) {
      const delta: string | undefined = chunk?.choices?.[0]?.delta?.content;
      if (delta) yield { delta };
      // The final chunk after a stop has `usage` populated when stream_options is set.
      if (chunk?.usage) {
        yield {
          done: true,
          usage: {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          },
        };
      }
    }
  }

  async generateStructured<T>(
    messages: LLMMessage[],
    opts: LLMStructuredOptions<T>,
  ): Promise<LLMStructuredResult<T>> {
    const jsonSchema = opts.jsonSchema ?? buildJsonSchemaFromZod(opts.schema);
    const res = await this.client.chat.completions.create({
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxOutputTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: opts.schemaName,
          strict: false,
          schema: jsonSchema,
        },
      },
    });
    return parseStructured(res, opts);
  }

  async generateVision<T>(
    messages: LLMMessage[],
    opts: LLMVisionOptions<T>,
  ): Promise<LLMStructuredResult<T>> {
    // Append the images to the last user message as an OpenAI vision content array.
    const last = messages[messages.length - 1];
    const visionMessages = [...messages.slice(0, -1)];
    const content: any[] = [{ type: 'text', text: last.content }];
    for (const url of opts.imageUrls) {
      content.push({ type: 'image_url', image_url: { url } });
    }
    visionMessages.push({ role: last.role, content } as any);

    const jsonSchema = opts.jsonSchema ?? buildJsonSchemaFromZod(opts.schema);
    const res = await this.client.chat.completions.create({
      model: opts.model,
      messages: visionMessages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxOutputTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: opts.schemaName,
          strict: false,
          schema: jsonSchema,
        },
      },
    });
    return parseStructured(res, opts);
  }
}

function parseStructured<T>(
  res: any,
  opts: { schema: { parse: (raw: unknown) => T } },
): LLMStructuredResult<T> {
  const choice = res?.choices?.[0];
  const finishReason: string | undefined = choice?.finish_reason;
  const text: string = choice?.message?.content ?? '';
  if (!text) throw new Error('provider returned empty response');
  // `length` means the model hit max_tokens before closing the JSON — the body
  // is valid-looking but truncated, so JSON.parse will fail with a confusing
  // error. Surface it explicitly so callers can raise the cap / classify it.
  if (finishReason === 'length') {
    throw new Error(
      `provider response truncated at max_tokens (${text.length} chars) — increase maxOutputTokens`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`provider returned non-JSON response (len=${text.length}): ${snippet}`);
  }
  const data = opts.schema.parse(raw);
  return {
    data,
    usage: {
      inputTokens: res?.usage?.prompt_tokens ?? 0,
      outputTokens: res?.usage?.completion_tokens ?? 0,
    },
  };
}

// Minimal Zod → JSON-schema converter. Covers the shapes we use (object/array/
// string/number/enum/optional/union literals/record). Good enough to anchor
// OpenAI's JSON-schema mode; final validation always goes through Zod.
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
