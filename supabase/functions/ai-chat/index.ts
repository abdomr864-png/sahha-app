// AI coach chat — SSE streaming.
// POST /functions/v1/ai-chat  { conversation_id?, message, locale }
//
// Auth: Bearer JWT. user_id is taken from the JWT, never the body.
//
// What this function does on every turn:
//   1. Auth + entitlement / daily-cap check.
//   2. Resolve or create the conversation row (linked to user via RLS).
//   3. Insert the user's message, then fetch the last N messages.
//   4. Pull a rich user-training context (profile, last 7d training, sleep,
//      mood, today's nutrition, recent PRs) using the shared fetcher.
//   5. Build a system prompt with that context AND the conversation's rolling
//      memory summary (so very long chats keep continuity).
//   6. Stream the model response over SSE, persisting it on completion.
//   7. If the conversation crossed the rollup threshold, regenerate the
//      memory summary in the background (fire-and-forget; failure is silent).

import { authenticate } from '../_shared/supabase.ts';
import { checkEntitlement, incrementUsage, isOverHardCap } from '../_shared/entitlement.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { corsHeaders, json, preflight } from '../_shared/http.ts';
import { fetchUserTrainingContext } from '../_shared/user-context.ts';
import { ChatRequestSchema, type LLMMessage } from '../../../lib/llm/types.ts';
import { coachSystemPrompt, memorySummaryPrompt } from '../../../lib/llm/prompts/coach.ts';
import { CHAT_INPUT_TOKEN_CAP, CHAT_OUTPUT_TOKEN_CAP, MODELS } from '../../../lib/llm/models.ts';

const FEATURE = 'ai_chat';
const MODEL = MODELS.chat;

// Keep the last N messages verbatim; everything older gets folded into the
// per-conversation rolling memory summary. 40 turns ≈ 20 user/assistant pairs,
// which is plenty of immediate context.
const RECENT_HISTORY_LIMIT = 40;
// Re-summarise once the conversation gets long enough that older messages have
// fallen out of the recent window.
const MEMORY_REFRESH_AT_MESSAGES = 30;
const MEMORY_REFRESH_EVERY = 20;

Deno.serve(async (req: Request) => {
  try {
    return await handleChat(req);
  } catch (e) {
    // Top-level safety net: any uncaught error (missing OPENAI_API_KEY,
    // import/runtime issue, etc.) used to surface as an opaque 500 without a
    // body. Now we return the actual message so the client can show it.
    const msg = (e as Error)?.message ?? String(e);
    console.error('[ai-chat] uncaught:', msg);
    return json(500, { error: 'provider_error', detail: msg.slice(0, 400) });
  }
});

async function handleChat(req: Request): Promise<Response> {
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
  } catch (e) {
    return json(400, { error: 'invalid_request', detail: (e as Error)?.message?.slice(0, 200) });
  }

  if (await isOverHardCap(admin, userId)) return json(429, { error: 'quota_exceeded' });

  const ent = await checkEntitlement(admin, userId, FEATURE, 1);
  if (!ent.allowed) {
    const code = ent.reason === 'premium_only' ? 'entitlement_required' : 'rate_limited';
    return json(429, { error: code });
  }

  // Resolve / create conversation.
  let conversationId = parsed.conversation_id ?? null;
  let memorySummary: string | null = null;
  if (conversationId) {
    const { data: existing } = await admin
      .from('ai_conversations')
      .select('id, memory_summary')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existing) {
      conversationId = null;
    } else {
      memorySummary = ((existing as Record<string, unknown>).memory_summary as string) ?? null;
    }
  }
  if (!conversationId) {
    const { data: created, error } = await admin
      .from('ai_conversations')
      .insert({ user_id: userId, title: parsed.message.slice(0, 80) })
      .select('id')
      .single();
    if (error || !created) {
      return json(500, {
        error: 'provider_error',
        detail: `conversation_insert: ${error?.message ?? 'unknown'}`,
      });
    }
    conversationId = (created as { id: string }).id;
  }

  // Insert user message.
  await admin.from('ai_messages').insert({
    conversation_id: conversationId,
    user_id: userId,
    role: 'user',
    content: parsed.message,
    tokens_used: 0,
  });

  // Pull recent history (newest last).
  const { data: history } = await admin
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(RECENT_HISTORY_LIMIT);
  const recent = ((history ?? []) as { role: 'user' | 'assistant' | 'system'; content: string }[])
    .slice()
    .reverse();

  // Rich user context pulled live every turn (profile + training + recovery +
  // nutrition + PRs). Best-effort: any missing piece comes back as null and
  // the prompt builder skips that line.
  const training = await fetchUserTrainingContext(admin, userId).catch(() => undefined);

  // Minor check uses dob from profile if available; the helper above doesn't
  // surface dob, so re-read it cheaply. Failing this query just defaults to adult.
  const isMinor = await fetchIsMinor(admin, userId);

  const systemPrompt = coachSystemPrompt({
    locale: parsed.locale,
    training,
    memorySummary,
    isMinor,
  });

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
  ];
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
          temperature: 0.6,
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

        // Compute the new message count, update the conversation row with the
        // freshest preview/timestamp, and decide whether to refresh memory.
        const { count: msgCount } = await admin
          .from('ai_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationId);

        const previewSource = assistantText.replace(/\s+/g, ' ').trim();
        await admin
          .from('ai_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: previewSource.slice(0, 160),
            message_count: msgCount ?? 0,
          })
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

        // Fire-and-forget memory rollup if the conversation is long enough.
        if (
          msgCount &&
          msgCount >= MEMORY_REFRESH_AT_MESSAGES &&
          msgCount % MEMORY_REFRESH_EVERY === 0
        ) {
          refreshMemorySummary({
            admin,
            conversationId,
            userId,
            locale: parsed.locale,
          }).catch(() => {});
        }
      } catch (e) {
        const errMsg = (e as Error).message ?? String(e);
        const code = errMsg?.includes('rate_limit') ? 'rate_limited' : 'provider_error';
        // Surface the underlying message to logs AND to the SSE client so the
        // app can show "no credits" / "invalid api key" / etc. instead of a
        // generic "having trouble" banner.
        console.error('[ai-chat] stream error:', errMsg);
        await logAICall(admin, {
          userId,
          feature: FEATURE,
          model: MODEL,
          inputTokens,
          outputTokens,
          status: 'error',
          errorCode: code,
        }).catch(() => {});
        send({ type: 'error', code, detail: errMsg.slice(0, 400) });
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
}

async function fetchIsMinor(admin: any, userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('dob').eq('user_id', userId).maybeSingle();
  const dob = (data as { dob?: string } | null)?.dob;
  if (!dob) return false;
  const ms = Date.now() - new Date(dob).getTime();
  return ms / (365.25 * 24 * 3600 * 1000) < 16;
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

// Regenerate the per-conversation rolling memory summary. Reads the older
// half of the message history and asks the model to compress it. Failure is
// silent — the next turn just runs with the previous summary.
async function refreshMemorySummary(args: {
  admin: any;
  conversationId: string;
  userId: string;
  locale: 'fr' | 'ar' | 'en';
}): Promise<void> {
  const { admin, conversationId, userId, locale } = args;
  const { data } = await admin
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  const rows = (data ?? []) as { role: 'user' | 'assistant'; content: string }[];
  if (rows.length < MEMORY_REFRESH_AT_MESSAGES) return;

  // Compress everything older than the recent window.
  const older = rows.slice(0, Math.max(0, rows.length - RECENT_HISTORY_LIMIT));
  if (older.length === 0) return;

  const provider = getOpenAI();
  const transcript = older
    .map((r) => `${r.role.toUpperCase()}: ${r.content}`)
    .join('\n')
    .slice(0, 12000);

  const messages: LLMMessage[] = [
    { role: 'system', content: memorySummaryPrompt(locale) },
    { role: 'user', content: `Summarise this earlier conversation:\n\n${transcript}` },
  ];

  let summary = '';
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    for await (const chunk of provider.streamChat(messages, {
      model: MODELS.chat,
      maxOutputTokens: 400,
      temperature: 0.2,
    })) {
      if (chunk.delta) summary += chunk.delta;
      if (chunk.usage) {
        inputTokens = chunk.usage.inputTokens;
        outputTokens = chunk.usage.outputTokens;
      }
    }
  } catch {
    return;
  }
  if (!summary.trim()) return;

  await admin
    .from('ai_conversations')
    .update({ memory_summary: summary.trim() })
    .eq('id', conversationId);

  await logAICall(admin, {
    userId,
    feature: FEATURE,
    model: MODELS.chat,
    inputTokens,
    outputTokens,
    status: 'success',
  }).catch(() => {});
}
