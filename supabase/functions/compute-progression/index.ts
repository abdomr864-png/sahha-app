// compute-progression: post-workout progression engine.
//
// Trigger: pg_net call from the workouts.ended_at dispatcher (0024).
// Inputs:  { workout_id, user_id }
//
// Reads the just-finished workout's sets, groups by exercise, evaluates the
// linear progression rules (reps → sets → weight), and writes:
//   * exercise_progression_log     — every decision, for audit/UX history
//   * next_session_suggestions     — one row per exercise that should change
//   * program_exercises.progression_model — updated current_* / weeks_at_current
//
// Pure logic — no AI calls. The "AI confidence" gate is just "two consecutive
// sessions of low-RPE evidence" per the addendum. Weight bumps are SUGGESTED
// only; the user accepts or overrides in-session.
//
// Service-role only.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { json, preflight } from '../_shared/http.ts';

// ─── types ────────────────────────────────────────────────────────────────

interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_index: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: boolean;
}

interface WorkoutExercise {
  id: string;
  exercise_id: string;
  workout_id: string;
}

interface ExerciseRow {
  id: string;
  muscle_group: string | null;
  equipment: string | null;
}

interface ProgressionModel {
  type: 'linear';
  target_reps_min: number;
  target_reps_max: number;
  target_sets: number;
  current_reps: number;
  current_sets: number;
  weeks_at_current: number;
}

interface ProgramExerciseLite {
  id: string;
  exercise_id: string;
  progression_model: ProgressionModel | null;
  target_sets: number | null;
  target_reps: number | null;
}

// ─── constants ────────────────────────────────────────────────────────────

const COMPOUND_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'back', 'chest', 'shoulders']);

const ISO_MUSCLES = new Set([
  'biceps',
  'triceps',
  'forearms',
  'calves',
  'lateral_delts',
  'rear_delts',
]);

function defaultModel(target_sets: number | null, target_reps: number | null): ProgressionModel {
  const reps = target_reps ?? 8;
  const sets = target_sets ?? 3;
  return {
    type: 'linear',
    target_reps_min: reps,
    target_reps_max: reps + 4,
    target_sets: sets,
    current_reps: reps,
    current_sets: sets,
    weeks_at_current: 0,
  };
}

function admin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, svc, { auth: { persistSession: false } });
}

// ─── helpers ──────────────────────────────────────────────────────────────

function workingSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => !s.is_warmup && s.reps > 0);
}

function avgRpe(sets: WorkoutSet[]): number | null {
  const withRpe = sets.filter((s) => s.rpe != null);
  if (withRpe.length === 0) return null;
  const sum = withRpe.reduce((acc, s) => acc + (s.rpe ?? 0), 0);
  return sum / withRpe.length;
}

function maxRpe(sets: WorkoutSet[]): number | null {
  const withRpe = sets.filter((s) => s.rpe != null);
  if (withRpe.length === 0) return null;
  return Math.max(...withRpe.map((s) => s.rpe ?? 0));
}

function topWeight(sets: WorkoutSet[]): number {
  return sets.reduce((m, s) => Math.max(m, s.weight_kg ?? 0), 0);
}

function weightIncrement(exercise: ExerciseRow | null): number {
  if (!exercise) return 2.5;
  const m = (exercise.muscle_group ?? '').toLowerCase();
  if (ISO_MUSCLES.has(m)) return 1.25;
  if (COMPOUND_MUSCLES.has(m)) return 2.5;
  return 2.5;
}

// ─── core decision ────────────────────────────────────────────────────────

interface Decision {
  exercise_id: string;
  program_exercise_id: string | null;
  next_reps: number | null;
  next_sets: number | null;
  next_weight_kg: number | null;
  reasoning: string;
  is_pr_attempt: boolean;
  events: {
    type: string;
    from?: unknown;
    to?: unknown;
  }[];
  new_model: ProgressionModel | null;
}

interface DecisionInput {
  exercise: ExerciseRow | null;
  programExercise: ProgramExerciseLite | null;
  sessionSets: WorkoutSet[];
  priorSessions: { sets: WorkoutSet[]; date: string }[]; // newest-first, excluding the current session
}

function decide(input: DecisionInput): Decision | null {
  const { exercise, programExercise, sessionSets, priorSessions } = input;
  const work = workingSets(sessionSets);
  if (work.length === 0) return null;

  const model =
    programExercise?.progression_model ??
    defaultModel(programExercise?.target_sets ?? null, programExercise?.target_reps ?? null);

  const sessionAvgRpe = avgRpe(work);
  const sessionMaxRpe = maxRpe(work);
  const topW = topWeight(work);

  const target = model.current_reps;
  const setsHittingTarget = work.filter((s) => s.reps >= target).length;
  const setsBelowTarget = work.filter((s) => s.reps < target).length;
  const allHit = setsHittingTarget >= model.current_sets;

  const events: Decision['events'] = [];

  // Failure path: held + maybe deload after 3 sticky weeks.
  if (setsBelowTarget >= 2 || sessionMaxRpe === 10) {
    const newModel: ProgressionModel = { ...model, weeks_at_current: model.weeks_at_current + 1 };
    events.push({ type: 'held', from: model, to: newModel });
    if (newModel.weeks_at_current >= 3) {
      events.push({ type: 'deload_suggested', from: model, to: newModel });
      return {
        exercise_id: programExercise?.exercise_id ?? sessionSets[0]!.workout_exercise_id,
        program_exercise_id: programExercise?.id ?? null,
        next_reps: Math.max(model.target_reps_min, model.current_reps - 2),
        next_sets: model.current_sets,
        next_weight_kg: Math.round(topW * 0.9 * 4) / 4, // -10%, rounded to nearest 0.25kg
        reasoning: 'Three weeks at the same load — suggesting a deload week.',
        is_pr_attempt: false,
        events,
        new_model: newModel,
      };
    }
    return {
      exercise_id: programExercise?.exercise_id ?? '',
      program_exercise_id: programExercise?.id ?? null,
      next_reps: null,
      next_sets: null,
      next_weight_kg: null,
      reasoning: '',
      is_pr_attempt: false,
      events,
      new_model: newModel,
    };
  }

  // Success path: all target reps hit AND avg RPE ≤ 8.
  if (allHit && (sessionAvgRpe ?? 0) <= 8) {
    // Try reps first, then sets.
    if (model.current_reps < model.target_reps_max) {
      const newModel: ProgressionModel = {
        ...model,
        current_reps: model.current_reps + 1,
        weeks_at_current: 0,
      };
      events.push({ type: 'reps_increased', from: model, to: newModel });
      return {
        exercise_id: programExercise?.exercise_id ?? '',
        program_exercise_id: programExercise?.id ?? null,
        next_reps: newModel.current_reps,
        next_sets: newModel.current_sets,
        next_weight_kg: topW,
        reasoning: `Hit ${model.current_reps} reps at RPE ≤ 8 — bumping to ${newModel.current_reps}.`,
        is_pr_attempt: false,
        events,
        new_model: newModel,
      };
    }
    if (model.current_sets < model.target_sets + 2) {
      const newModel: ProgressionModel = {
        ...model,
        current_sets: model.current_sets + 1,
        current_reps: model.target_reps_min,
        weeks_at_current: 0,
      };
      events.push({ type: 'sets_increased', from: model, to: newModel });
      return {
        exercise_id: programExercise?.exercise_id ?? '',
        program_exercise_id: programExercise?.id ?? null,
        next_reps: newModel.current_reps,
        next_sets: newModel.current_sets,
        next_weight_kg: topW,
        reasoning: `Maxed reps at ${model.target_reps_max} — adding a set, resetting to ${newModel.current_reps}.`,
        is_pr_attempt: false,
        events,
        new_model: newModel,
      };
    }

    // Weight progression — requires two-session low-RPE evidence.
    const priorAvg = priorSessions[0] ? avgRpe(workingSets(priorSessions[0].sets)) : null;
    const weightEligible =
      sessionAvgRpe != null && sessionAvgRpe <= 7 && priorAvg != null && priorAvg <= 7;
    if (weightEligible) {
      const inc = weightIncrement(exercise);
      const next = Math.round((topW + inc) * 4) / 4;
      // PR-territory variant: three consecutive ≤ RPE 6.
      const priorAvg2 = priorSessions[1] ? avgRpe(workingSets(priorSessions[1].sets)) : null;
      const prTrigger =
        sessionAvgRpe != null &&
        sessionAvgRpe <= 6 &&
        priorAvg != null &&
        priorAvg <= 6 &&
        priorAvg2 != null &&
        priorAvg2 <= 6;
      const newModel: ProgressionModel = { ...model, weeks_at_current: 0 };
      events.push({
        type: prTrigger ? 'pr_prompt' : 'weight_suggested',
        from: { weight_kg: topW },
        to: { weight_kg: prTrigger ? topW + inc * 2 : next },
      });
      return {
        exercise_id: programExercise?.exercise_id ?? '',
        program_exercise_id: programExercise?.id ?? null,
        next_reps: model.current_reps,
        next_sets: model.current_sets,
        next_weight_kg: prTrigger ? topW + inc * 2 : next,
        reasoning: prTrigger
          ? `Three sessions at RPE ≤ 6 — PR territory.`
          : `Two sessions at RPE ≤ 7 — try +${inc}kg next time.`,
        is_pr_attempt: prTrigger,
        events,
        new_model: newModel,
      };
    }

    // All targets hit but no weight evidence: hold the line, suggest the same.
    const newModel: ProgressionModel = { ...model, weeks_at_current: 0 };
    return {
      exercise_id: programExercise?.exercise_id ?? '',
      program_exercise_id: programExercise?.id ?? null,
      next_reps: model.current_reps,
      next_sets: model.current_sets,
      next_weight_kg: topW,
      reasoning: 'On target. Repeat next session and log RPE for weight progression.',
      is_pr_attempt: false,
      events: [{ type: 'held', from: model, to: newModel }],
      new_model: newModel,
    };
  }

  // Neither clear success nor clear failure — hold.
  const newModel: ProgressionModel = { ...model, weeks_at_current: model.weeks_at_current + 1 };
  return {
    exercise_id: programExercise?.exercise_id ?? '',
    program_exercise_id: programExercise?.id ?? null,
    next_reps: null,
    next_sets: null,
    next_weight_kg: null,
    reasoning: '',
    is_pr_attempt: false,
    events: [{ type: 'held', from: model, to: newModel }],
    new_model: newModel,
  };
}

// ─── persistence ──────────────────────────────────────────────────────────

async function applyDecisions(
  db: SupabaseClient,
  userId: string,
  decisionsByExercise: Map<string, Decision>,
): Promise<void> {
  for (const [exerciseId, d] of decisionsByExercise) {
    // 1. Update program_exercise progression_model.
    if (d.program_exercise_id && d.new_model) {
      await db
        .from('program_exercises')
        .update({ progression_model: d.new_model })
        .eq('id', d.program_exercise_id);
    }

    // 2. Log every event.
    for (const ev of d.events) {
      await db.from('exercise_progression_log').insert({
        user_id: userId,
        exercise_id: exerciseId,
        program_exercise_id: d.program_exercise_id,
        event_type: ev.type,
        from_value: ev.from ?? null,
        to_value: ev.to ?? null,
      });
    }

    // 3. Insert a next_session_suggestion if anything actionable changed.
    if (d.next_reps != null || d.next_sets != null || d.next_weight_kg != null) {
      // Supersede any older unconsumed row for the same exercise so the
      // in-session card always shows the freshest suggestion.
      await db
        .from('next_session_suggestions')
        .update({ consumed_at: new Date().toISOString(), consumed_decision: 'declined' })
        .is('consumed_at', null)
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId);

      await db.from('next_session_suggestions').insert({
        user_id: userId,
        exercise_id: exerciseId,
        program_exercise_id: d.program_exercise_id,
        suggested_reps: d.next_reps,
        suggested_sets: d.next_sets,
        suggested_weight_kg: d.next_weight_kg,
        reasoning: d.reasoning,
        is_pr_attempt: d.is_pr_attempt,
      });
    }
  }
}

// ─── handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'invalid_request' });

  // Service-role only — called by the dispatcher trigger.
  const auth = req.headers.get('authorization') ?? '';
  const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!auth || !svc || !auth.toLowerCase().includes(svc.toLowerCase())) {
    return json(401, { error: 'unauthenticated' });
  }

  let body: { workout_id?: string; user_id?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'invalid_input' });
  }
  if (!body.workout_id || !body.user_id) return json(400, { error: 'invalid_input' });

  const db = admin();

  // 1) Pull the workout's exercises + sets.
  const { data: workoutExercises } = await db
    .from('workout_exercises')
    .select('id, exercise_id, workout_id')
    .eq('workout_id', body.workout_id);
  if (!workoutExercises || workoutExercises.length === 0) {
    return json(200, { processed: 0, reason: 'no_exercises' });
  }

  const weIds = workoutExercises.map((we) => (we as WorkoutExercise).id);
  const { data: sets } = await db
    .from('workout_sets')
    .select('id, workout_exercise_id, set_index, reps, weight_kg, rpe, is_warmup')
    .in('workout_exercise_id', weIds);

  const setsByWe = new Map<string, WorkoutSet[]>();
  for (const s of (sets as WorkoutSet[]) ?? []) {
    const arr = setsByWe.get(s.workout_exercise_id) ?? [];
    arr.push(s);
    setsByWe.set(s.workout_exercise_id, arr);
  }

  // 2) Pull exercise metadata.
  const exerciseIds = Array.from(
    new Set((workoutExercises as WorkoutExercise[]).map((w) => w.exercise_id)),
  );
  const { data: exercises } = await db
    .from('exercises')
    .select('id, muscle_group, equipment')
    .in('id', exerciseIds);
  const exerciseById = new Map<string, ExerciseRow>();
  for (const e of (exercises as ExerciseRow[]) ?? []) exerciseById.set(e.id, e);

  // 3) Pull program_exercises (active program) for these exercises.
  //    A user can have multiple programs; we pick the most recent program_exercise
  //    row per exercise_id that belongs to one of the user's programs.
  const { data: programs } = await db.from('programs').select('id').eq('user_id', body.user_id);
  const programIds = (programs ?? []).map((p) => (p as { id: string }).id);
  const programExerciseByExerciseId = new Map<string, ProgramExerciseLite>();
  if (programIds.length > 0) {
    const { data: programDays } = await db
      .from('program_days')
      .select('id, program_id')
      .in('program_id', programIds);
    const programDayIds = (programDays ?? []).map((d) => (d as { id: string }).id);
    if (programDayIds.length > 0) {
      const { data: progExs } = await db
        .from('program_exercises')
        .select('id, exercise_id, progression_model, target_sets, target_reps, program_day_id')
        .in('program_day_id', programDayIds);
      for (const pe of (progExs as ProgramExerciseLite[]) ?? []) {
        // First write wins (rows aren't versioned; if user has two programs
        // hitting the same exercise we accept the first).
        if (!programExerciseByExerciseId.has(pe.exercise_id)) {
          programExerciseByExerciseId.set(pe.exercise_id, pe);
        }
      }
    }
  }

  // 4) Pull last 2 prior sessions per exercise (excluding current workout).
  const priorByExercise = new Map<string, { sets: WorkoutSet[]; date: string }[]>();
  for (const exId of exerciseIds) {
    const { data: priorWes } = await db
      .from('workout_exercises')
      .select('id, workout_id, workouts!inner(started_at, user_id, ended_at)')
      .eq('exercise_id', exId)
      .eq('workouts.user_id', body.user_id)
      .neq('workout_id', body.workout_id)
      .not('workouts.ended_at', 'is', null)
      .order('id', { ascending: false })
      .limit(5);
    // deno-lint-ignore no-explicit-any
    const rows = (priorWes as any[]) ?? [];
    rows.sort((a, b) => {
      const ad = a.workouts?.started_at ?? '';
      const bd = b.workouts?.started_at ?? '';
      return bd.localeCompare(ad);
    });
    const prior: { sets: WorkoutSet[]; date: string }[] = [];
    for (const w of rows.slice(0, 2)) {
      const { data: pSets } = await db
        .from('workout_sets')
        .select('id, workout_exercise_id, set_index, reps, weight_kg, rpe, is_warmup')
        .eq('workout_exercise_id', w.id);
      prior.push({
        sets: (pSets as WorkoutSet[]) ?? [],
        date: (w.workouts?.started_at as string) ?? '',
      });
    }
    priorByExercise.set(exId, prior);
  }

  // 5) Run decision per exercise.
  const decisionsByExercise = new Map<string, Decision>();
  for (const we of workoutExercises as WorkoutExercise[]) {
    const sessionSets = setsByWe.get(we.id) ?? [];
    const programEx = programExerciseByExerciseId.get(we.exercise_id) ?? null;
    const exercise = exerciseById.get(we.exercise_id) ?? null;
    const prior = priorByExercise.get(we.exercise_id) ?? [];
    const d = decide({
      exercise,
      programExercise: programEx,
      sessionSets,
      priorSessions: prior,
    });
    if (!d) continue;
    d.exercise_id = we.exercise_id;
    decisionsByExercise.set(we.exercise_id, d);
  }

  // 6) Persist.
  await applyDecisions(db, body.user_id, decisionsByExercise);

  return json(200, {
    processed: decisionsByExercise.size,
    decisions: Array.from(decisionsByExercise.entries()).map(([eid, d]) => ({
      exercise_id: eid,
      reasoning: d.reasoning,
      events: d.events.map((e) => e.type),
    })),
  });
});
