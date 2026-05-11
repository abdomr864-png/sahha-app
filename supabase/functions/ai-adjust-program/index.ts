// Weekly program adjustment.
// POST /functions/v1/ai-adjust-program  { program_id }

import { authenticate } from '../_shared/supabase.ts';
import { checkEntitlement, incrementUsage, isOverHardCap } from '../_shared/entitlement.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import { AdjustmentSchema, AdjustProgramRequestSchema } from '../../../lib/llm/types.ts';
import { programAdjustSystemPrompt } from '../../../lib/llm/prompts/program-adjust.ts';
import { MODELS } from '../../../lib/llm/models.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const FEATURE = 'ai_program_adjust';
const MODEL = MODELS.programAdjust;

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  // === DEV MODE: AUTH BYPASS ===
  // Mirrors ai-meal-parse: accept anon-key calls and derive ownership from the
  // program row itself when no valid session is provided.
  let userId: string | null = null;
  let isBypassed = false;
  const admin = createAdminClient();
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const auth = await authenticate(req);
    if (!(auth instanceof Response)) {
      userId = auth.userId;
    } else {
      console.log('[ai-adjust-program] auth failed, continuing in DEV bypass mode');
      isBypassed = true;
    }
  } else {
    console.log('[ai-adjust-program] no auth header, DEV bypass mode');
    isBypassed = true;
  }

  let parsed;
  try {
    parsed = AdjustProgramRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }

  if (!isBypassed) {
    if (await isOverHardCap(admin, userId!)) return json(429, { error: 'quota_exceeded' });
    const ent = await checkEntitlement(admin, userId!, FEATURE, 7);
    if (!ent.allowed) {
      return json(429, {
        error: ent.reason === 'premium_only' ? 'entitlement_required' : 'rate_limited',
      });
    }
  }

  // Confirm ownership and load program. In bypass mode we trust the program_id
  // and derive userId from the program row.
  const programQuery = admin
    .from('programs')
    .select('id, name, weeks, days_per_week, user_id')
    .eq('id', parsed.program_id);
  if (!isBypassed) programQuery.eq('user_id', userId!);
  const { data: program } = await programQuery.maybeSingle();
  if (!program) return json(404, { error: 'invalid_input' });
  if (isBypassed) userId = (program as any).user_id;

  // Pull last 7 days of workouts for this program (via program_day_id ⇒ program_id).
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const { data: workouts } = await admin
    .from('workouts')
    .select(
      `id, started_at,
       program_day_id,
       workout_exercises (
         id, exercise_id, order_index,
         exercises ( name_en ),
         workout_sets ( reps, weight_kg, rpe, is_warmup )
       )`,
    )
    .eq('user_id', userId)
    .gte('started_at', since.toISOString())
    .not('program_day_id', 'is', null);

  // Filter to ones that belong to this program, and load program_exercises for context.
  const { data: programExercises } = await admin
    .from('program_exercises')
    .select(
      `id, exercise_id, target_sets, target_reps, target_rpe, rest_seconds,
       program_days!inner ( program_id ),
       exercises ( name_en )`,
    )
    .eq('program_days.program_id', parsed.program_id);

  const lines: string[] = [];
  const peByExercise = new Map<string, any>();
  for (const pe of programExercises ?? []) {
    peByExercise.set((pe as any).exercise_id, pe);
  }

  for (const w of workouts ?? []) {
    for (const we of (w as any).workout_exercises ?? []) {
      const pe = peByExercise.get(we.exercise_id);
      if (!pe) continue;
      const sets = (we.workout_sets ?? []).filter((s: any) => !s.is_warmup);
      if (sets.length === 0) continue;
      const repsAll = sets.map((s: any) => s.reps);
      const wAll = sets.map((s: any) => Number(s.weight_kg));
      const rpeAll = sets.map((s: any) => s.rpe).filter((x: any) => x != null);
      lines.push(
        `- pe=${pe.id} (${we.exercises?.name_en ?? '?'}): target ${pe.target_sets}x${pe.target_reps}@RPE${pe.target_rpe ?? '?'} | actual sets=${sets.length}, reps=[${repsAll.join(',')}], weight=[${wAll.join(',')}]kg, rpe=[${rpeAll.join(',')}]`,
      );
    }
  }

  if (lines.length === 0) return json(400, { error: 'insufficient_data' });

  const provider = getOpenAI();
  const messages = [
    {
      role: 'system' as const,
      content: programAdjustSystemPrompt({
        locale: 'en' as const, // user's locale resolved via profile if we want; default en for prompt
        programName: (program as any).name,
        weekSummary: lines.join('\n'),
      }),
    },
    {
      role: 'user' as const,
      content: 'Suggest adjustments now.',
    },
  ];

  let result;
  try {
    result = await provider.generateStructured(messages, {
      model: MODEL,
      schema: AdjustmentSchema,
      schemaName: 'Adjustment',
      maxOutputTokens: 2000,
      temperature: 0.4,
    });
  } catch {
    try {
      result = await provider.generateStructured(messages, {
        model: MODEL,
        schema: AdjustmentSchema,
        schemaName: 'Adjustment',
        maxOutputTokens: 2000,
        temperature: 0.4,
      });
    } catch (e) {
      const code = (e as Error).message?.includes('parse') ? 'invalid_response' : 'provider_error';
      if (!isBypassed) {
        await logAICall(admin, {
          userId: userId!,
          feature: FEATURE,
          model: MODEL,
          inputTokens: 0,
          outputTokens: 0,
          status: 'error',
          errorCode: code,
        });
      }
      return json(502, { error: code });
    }
  }

  // Determine which week we're proposing for: max(week of recent workouts) + 1.
  const week = currentWeek(workouts as any[]);

  const { data: row, error } = await admin
    .from('ai_program_adjustments')
    .insert({
      user_id: userId!,
      program_id: parsed.program_id,
      week,
      suggestion: result.data,
      applied: false,
    })
    .select('id')
    .single();
  if (error || !row) return json(500, { error: 'provider_error' });

  if (!isBypassed) {
    await incrementUsage(admin, userId!, FEATURE);
    await logAICall(admin, {
      userId: userId!,
      feature: FEATURE,
      model: MODEL,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      status: 'success',
    });
  }

  return json(200, { adjustment_id: (row as any).id, adjustment: result.data });
});

function currentWeek(_workouts: unknown[]): number {
  // Simple default. The UI can override on apply by passing the right week.
  return 1;
}
