// Abstract LLM provider. Concrete implementations live next to this file
// (openai-provider.ts) and run inside Edge Functions only.

import type {
  LLMChatOptions,
  LLMMessage,
  LLMStreamChunk,
  LLMStructuredOptions,
  LLMStructuredResult,
  LLMVisionOptions,
} from './types.ts';

export interface LLMProvider {
  readonly id: string;

  /** Token-by-token streaming for chat. The final chunk carries `usage`. */
  streamChat(messages: LLMMessage[], opts: LLMChatOptions): AsyncIterable<LLMStreamChunk>;

  /** Single-shot structured output validated by the provider's JSON-schema mode. */
  generateStructured<T>(
    messages: LLMMessage[],
    opts: LLMStructuredOptions<T>,
  ): Promise<LLMStructuredResult<T>>;

  /** Vision + structured output (frames in, schema-validated JSON out). */
  generateVision<T>(
    messages: LLMMessage[],
    opts: LLMVisionOptions<T>,
  ): Promise<LLMStructuredResult<T>>;
}
