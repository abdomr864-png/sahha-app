// AI coach chat — SSE streaming.
// POST /functions/v1/ai-chat  { conversation_id?, message, locale }
//
// Auth: Bearer JWT. user_id is taken from the JWT, never the body.

import { authenticate } from '../_shared/supabase.ts';
import { checkEntitlement, incrementUsage, isOverHardCap } from '../_shared/entitlement.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { corsHeaders, json, preflight } from '../_shared/http.ts';
import { ChatRequestSchema, type LLMMessage } from '../../../lib/llm/types.ts';
import { coachSystemPrompt } from '../../../lib/llm/prompts/coach.ts';
import { CHAT_INPUT_TOKEN_CAP, CHAT_OUTPUT_TOKEN_CAP, MODELS } from '../../../lib/llm/models.ts';

const FEATURE = 'ai_chat';
const MODEL = MODELS.chat;

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { userId, admin } = auth;

  let parsed;
  try {
    const body = await req.json();
    parsed = ChatRequestSchema.parse(body);
  } catch {
    return json(400, { error: 'invalid_request' });
  }

  if (await isOverHardCap(admin, userId)) return json(429, { error: 'quota_exceeded' });

  const ent = await checkEntitlement(admin, userId, FEATURE, 1);
  if (!ent.allowed) {
    const code = ent.reason === 'premium_only' ? 'entitlement_required' : 'rate_limited';
    return json(429, { error: code });
  }

  // Resolve / create conversation.
  let conversationId = parsed.conversation_id ?? null;
  if (conversationId) {
    const { data: existing } = await admin
      .from('ai_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existing) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error } = await admin
      .from('ai_conversations')
      .insert({ user_id: userId, title: parsed.message.slice(0, 80) })
      .select('id')
      .single();
    if (error || !created) return json(500, { error: 'provider_error' });
    conversationId = (created as any).id as string;
  }

  // Insert user message.
  await admin.from('ai_messages').insert({
    conversation_id: conversationId,
    user_id: userId,
    role: 'user',
    content: parsed.message,
    tokens_used: 0,
  });

  // Pull last 20 messages (newest last).
  const { data: history } = await admin
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  // Pull user context (best-effort; missing tables/rows are tolerated).
  const { data: profile } = await admin
    .from('profiles')
    .select('goal, experience_level, weight_kg, dob, locale')
    .eq('user_id', userId)
    .maybeSingle();

  const isMinor = profile?.dob ? ageYears(profile.dob) < 16 : false;
  const profileSummary = profile
    ? `goal=${(profile as any).goal ?? 'unspecified'}, experience=${(profile as any).experience_level ?? 'unspecified'}, weight=${(profile as any).weight_kg ?? '?'}kg`
    : undefined;

  const systemPrompt = coachSystemPrompt({
    locale: parsed.locale,
    profileSummary,
    isMinor,
  });

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...((history ?? []) as { role: 'user' | 'assistant' | 'system'; content: string }[]).map(
      (m) => ({ role: m.role, content: m.content }),
    ),
  ];

  // Truncate to fit input cap (rough: ~4 chars/token).
  truncateMessages(messages, CHAT_INPUT_TOKEN_CAP);

  const provider = getOpenAI();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: 'conversation', id: conversationId });

      let assistantText = '';
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        for await (const chunk of provider.streamChat(messages, {
          model: MODEL,
          maxOutputTokens: CHAT_OUTPUT_TOKEN_CAP,
          temperature: 0.7,
        })) {
          if (chunk.delta) {
            assistantText += chunk.delta;
            send({ type: 'token', delta: chunk.delta });
          }
          if (chunk.usage) {
            inputTokens = chunk.usage.inputTokens;
            outputTokens = chunk.usage.outputTokens;
          }
        }

        await admin.from('ai_messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: assistantText,
          tokens_used: outputTokens,
        });
        await admin
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);
        await incrementUsage(admin, userId, FEATURE);
        await logAICall(admin, {
          userId,
          feature: FEATURE,
          model: MODEL,
          inputTokens,
          outputTokens,
          status: 'success',
        });

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        const code = (e as Error).message?.includes('rate_limit')
          ? 'rate_limited'
          : 'provider_error';
        await logAICall(admin, {
          userId,
          feature: FEATURE,
          model: MODEL,
          inputTokens,
          outputTokens,
          status: 'error',
          errorCode: code,
        }).catch(() => {});
        send({ type: 'error', code });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
});

function ageYears(dob: string): number {
  const d = new Date(dob);
  const ms = Date.now() - d.getTime();
  return ms / (365.25 * 24 * 3600 * 1000);
}

// Drop oldest non-system messages until we fit. Char→token ≈ 4.
function truncateMessages(messages: LLMMessage[], inputTokenCap: number): void {
  const charCap = inputTokenCap * 4;
  let total = messages.reduce((s, m) => s + m.content.length, 0);
  let i = 1; // keep index 0 (system)
  while (total > charCap && i < messages.length - 1) {
    total -= messages[i].content.length;
    messages.splice(i, 1);
  }
}
