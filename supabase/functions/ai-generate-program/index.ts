// AI-generated training program (premium-only).
// POST /functions/v1/ai-generate-program
//
// Modes:
//   - 'save'    (default, backwards-compatible) — persists into programs/days/exercises
//   - 'preview' — returns the generated structure without persisting; the
//                 client's preview UI lets the user edit before committing
//                 via a follow-up explicit save call.

import { authenticate } from '../_shared/supabase.ts';
import { logAICall } from '../_shared/logging.ts';
import { getOpenAI } from '../_shared/openai.ts';
import { json, preflight } from '../_shared/http.ts';
import { fetchUserTrainingContext } from '../_shared/user-context.ts';
import {
  GenerateProgramExtendedRequestSchema,
  ProgramWithReasoningSchema,
  type Program,
} from '../../../lib/llm/types.ts';
import { programGenSystemPrompt } from '../../../lib/llm/prompts/program-gen.ts';
import { getPersonaPromptBlock } from '../../../lib/llm/prompts/persona.ts';
import { MODELS } from '../../../lib/llm/models.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

function createAdminClient() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

const DEV_USER_ID = '00000000-0000-0000-0000-000000000000';

const FEATURE = 'ai_program_gen';
const MODEL = MODELS.programGen;

// deno-lint-ignore no-explicit-any
type Admin = any;

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  // DEV BYPASS: see ai-meal-parse for context. Auth is optional; entitlement +
  // quota are skipped. Re-enable when sign-in works.
  let userId = DEV_USER_ID;
  const admin = createAdminClient();
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const auth = await authenticate(req);
    if (!(auth instanceof Response)) userId = auth.userId;
  }
  const isDev = userId === DEV_USER_ID;

  let parsed;
  try {
    parsed = GenerateProgramExtendedRequestSchema.parse(await req.json());
  } catch {
    return json(400, { error: 'invalid_input' });
  }
  const mode = isDev ? 'preview' : (parsed.mode ?? 'save');

  const [userCtx, persona] = await Promise.all([
    isDev ? Promise.resolve({}) : fetchUserTrainingContext(admin, userId),
    isDev ? Promise.resolve(null) : getPersonaPromptBlock(admin, userId),
  ]);

  const provider = getOpenAI();
  const messages = [
    {
      role: 'system' as const,
      content: programGenSystemPrompt({
        locale: parsed.locale,
        goal: parsed.goal,
        experience: parsed.experience,
        daysPerWeek: parsed.days_per_week,
        equipment: parsed.equipment,
        weeks: parsed.weeks,
        preferences: parsed.preferences,
        user: userCtx,
        persona,
      }),
    },
    {
      role: 'user' as const,
      content: 'Design the program now.',
    },
  ];

  const callOnce = () =>
    provider.generateStructured(messages, {
      model: MODEL,
      schema: ProgramWithReasoningSchema,
      schemaName: 'Program',
      // Week-1 template: 1 week × N days, not weeks × N days. Tight cap keeps
      // generation fast and avoids truncation that previously surfaced as
      // `provider_error` to the user.
      maxOutputTokens: 2200,
      temperature: 0.5,
    });

  let result;
  try {
    result = await callOnce();
  } catch {
    try {
      result = await callOnce();
    } catch (e) {
      const code = (e as Error).message?.includes('parse') ? 'invalid_response' : 'provider_error';
      await logAICall(admin, {
        userId,
        feature: FEATURE,
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        status: 'error',
        errorCode: code,
      });
      return json(502, { error: code });
    }
  }

  // The model returns a single-week template (per program-gen prompt). Expand
  // it across `weeks` here so persistence + preview match the requested length.
  result.data = expandTemplate(result.data, parsed.weeks);

  // Skip usage increment in dev bypass — usage_counters has no row for the dummy user.
  await logAICall(admin, {
    userId,
    feature: FEATURE,
    model: MODEL,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    status: 'success',
  });

  if (mode === 'preview') {
    return json(200, {
      program_id: null,
      program: result.data,
      program_reasoning: result.data.program_reasoning ?? null,
    });
  }

  let programId: string;
  try {
    programId = await persistProgram(admin, userId, parsed, result.data);
  } catch (e) {
    return json(500, { error: 'provider_error', detail: (e as Error).message });
  }

  return json(200, {
    program_id: programId,
    program: result.data,
    program_reasoning: result.data.program_reasoning ?? null,
  });
});

// Expand a single-week template to `targetWeeks` weeks. The model only emits
// week 1 (saves tokens and time); the server replicates it across the program
// length and applies a deload near the 75% mark.
function expandTemplate(
  prog: Program & { program_reasoning?: string },
  targetWeeks: number,
): Program & { program_reasoning?: string } {
  const weekOneDays = (prog.days ?? []).filter((d) => d.week === 1);
  // Defensive: if the model already returned multi-week output, trust it.
  if (prog.days.some((d) => d.week > 1) || weekOneDays.length === 0) {
    return { ...prog, weeks: targetWeeks };
  }
  const deloadWeek = Math.max(2, Math.ceil(targetWeeks * 0.75));
  const expandedDays: Program['days'] = [];
  for (let week = 1; week <= targetWeeks; week++) {
    const isDeload = week === deloadWeek && targetWeeks >= 4;
    for (const day of weekOneDays) {
      expandedDays.push({
        week,
        day_index: day.day_index,
        name: day.name,
        exercises: day.exercises.map((ex) => ({
          ...ex,
          rpe: isDeload && typeof ex.rpe === 'number' ? Math.max(6, ex.rpe - 2) : ex.rpe,
          notes: isDeload
            ? [ex.notes, 'Deload week — keep weight, lower intensity.'].filter(Boolean).join(' · ')
            : ex.notes,
        })),
      });
    }
  }
  return {
    ...prog,
    weeks: targetWeeks,
    days: expandedDays,
  };
}

async function persistProgram(
  admin: Admin,
  userId: string,
  req: { goal: string; days_per_week: number; weeks: number },
  prog: Program & { program_reasoning?: string },
): Promise<string> {
  const { data: createdProgram, error: pErr } = await admin
    .from('programs')
    .insert({
      user_id: userId,
      name: prog.name,
      goal: req.goal,
      weeks: prog.weeks,
      days_per_week: prog.days_per_week,
      is_ai_generated: true,
      source: 'openai/' + MODEL,
      ai_reasoning: prog.program_reasoning ?? null,
      generation_input: req,
    })
    .select('id')
    .single();
  if (pErr || !createdProgram) throw pErr ?? new Error('program_insert_failed');
  const programId = createdProgram.id as string;

  for (const day of prog.days) {
    const { data: createdDay, error: dErr } = await admin
      .from('program_days')
      .insert({
        program_id: programId,
        week: day.week,
        day_index: day.day_index,
        name: day.name,
      })
      .select('id')
      .single();
    if (dErr || !createdDay) throw dErr ?? new Error('day_insert_failed');
    const dayId = createdDay.id as string;

    for (let i = 0; i < day.exercises.length; i++) {
      const ex = day.exercises[i];
      const exerciseId = await resolveExerciseId(admin, userId, ex.name, ex.muscle_group);
      const lowerBound = parseLowerRep(ex.reps);
      await admin.from('program_exercises').insert({
        program_day_id: dayId,
        exercise_id: exerciseId,
        order_index: i,
        target_sets: ex.sets,
        target_reps: lowerBound,
        target_rpe: ex.rpe ?? null,
        rest_seconds: ex.rest_seconds,
        notes: [ex.reps !== String(lowerBound) ? `reps: ${ex.reps}` : null, ex.notes]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  return programId;
}

async function resolveExerciseId(
  admin: Admin,
  userId: string,
  name: string,
  muscleGroup: string,
): Promise<string> {
  const { data: exact } = await admin
    .from('exercises')
    .select('id')
    .or(`name_en.ilike.${name},name_fr.ilike.${name},name_ar.ilike.${name}`)
    .eq('is_custom', false)
    .limit(1)
    .maybeSingle();
  if (exact) return exact.id as string;

  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length) {
    const { data: candidates } = await admin
      .from('exercises')
      .select('id, name_en')
      .eq('is_custom', false)
      .ilike('name_en', `%${tokens[tokens.length - 1]}%`)
      .limit(20);
    const best = (candidates ?? []).find((c: { name_en: string }) =>
      tokens.every((t) => c.name_en.toLowerCase().includes(t)),
    );
    if (best) return best.id as string;
  }

  const { data: created, error } = await admin
    .from('exercises')
    .insert({
      name_en: name,
      name_fr: name,
      name_ar: name,
      muscle_group: muscleGroup.toLowerCase(),
      equipment: 'unspecified',
      is_custom: true,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error || !created) throw error ?? new Error('exercise_create_failed');
  return created.id as string;
}

function parseLowerRep(reps: string): number {
  const m = reps.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 8;
}
