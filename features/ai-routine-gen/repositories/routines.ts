// Persists a draft AI-generated workout or program into the database.
// Workout drafts → programs (is_template=true) + program_days(week=1) +
// program_exercises. Program drafts → programs + program_days + program_exercises.

import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';
import type { GeneratedWorkout, Program, WorkoutExercise } from '@lib/llm';

function parseLowerRep(reps: string): number {
  const m = reps.match(/(\d+)/);
  return m && m[1] ? parseInt(m[1], 10) : 8;
}

export async function saveWorkoutAsTemplate(
  userId: string,
  workout: GeneratedWorkout,
  generationId: string | null,
): Promise<string> {
  const program = (await mapSb(
    supabase
      .from('programs')
      .insert({
        user_id: userId,
        name: workout.name,
        weeks: 1,
        days_per_week: 1,
        is_template: true,
        is_ai_generated: true,
        source: 'ai-generate-workout',
        ai_reasoning: workout.reasoning,
      })
      .select('id')
      .single(),
  )) as { id: string };

  const day = (await mapSb(
    supabase
      .from('program_days')
      .insert({ program_id: program.id, week: 1, day_index: 0, name: workout.focus })
      .select('id')
      .single(),
  )) as { id: string };

  await Promise.all(workout.exercises.map((ex, i) => insertExercise(day.id, ex, i)));

  if (generationId) {
    await supabase
      .from('ai_generated_workouts')
      .update({ was_saved_as_template: true })
      .eq('id', generationId);
  }
  return program.id;
}

export async function saveProgramFromDraft(
  userId: string,
  program: Program & { program_reasoning?: string },
  request: { goal: string; weeks: number; days_per_week: number },
): Promise<string> {
  // 1) Insert program (1 round-trip).
  const created = (await mapSb(
    supabase
      .from('programs')
      .insert({
        user_id: userId,
        name: program.name,
        goal: request.goal,
        weeks: program.weeks,
        days_per_week: program.days_per_week,
        is_ai_generated: true,
        source: 'ai-generate-program',
        ai_reasoning: program.program_reasoning ?? null,
        generation_input: request,
      })
      .select('id')
      .single(),
  )) as { id: string };

  // 2) Resolve all unique exercise IDs in parallel (cached per name) —
  //    avoids 4w * Nd * Ne round-trips per insert.
  const uniqueByName = new Map<string, string>();
  for (const day of program.days) {
    for (const ex of day.exercises) {
      const key = ex.name.toLowerCase();
      if (!uniqueByName.has(key)) uniqueByName.set(key, ex.muscle_group);
    }
  }
  const idEntries = await Promise.all(
    Array.from(uniqueByName.entries()).map(
      async ([name, mg]) => [name, await ensureCustomExercise(name, mg, userId)] as const,
    ),
  );
  const exerciseIdByName = new Map(idEntries);

  // 3) Batch-insert all program_days in a single call.
  const dayRows = program.days.map((d) => ({
    program_id: created.id,
    week: d.week,
    day_index: d.day_index,
    name: d.name,
  }));
  const insertedDays = (await mapSb(
    supabase.from('program_days').insert(dayRows).select('id, week, day_index'),
  )) as Array<{ id: string; week: number; day_index: number }>;
  const dayIdByKey = new Map(insertedDays.map((d) => [`${d.week}-${d.day_index}`, d.id]));

  // 4) Batch-insert all program_exercises in a single call.
  const exerciseRows: Array<Record<string, unknown>> = [];
  for (const day of program.days) {
    const dayId = dayIdByKey.get(`${day.week}-${day.day_index}`);
    if (!dayId) continue;
    day.exercises.forEach((ex, i) => {
      const lower = parseLowerRep(ex.reps);
      exerciseRows.push({
        program_day_id: dayId,
        exercise_id: exerciseIdByName.get(ex.name.toLowerCase()),
        order_index: i,
        target_sets: ex.sets,
        target_reps: lower,
        target_rpe: ex.rpe ?? null,
        rest_seconds: ex.rest_seconds,
        notes: [ex.reps !== String(lower) ? `reps: ${ex.reps}` : null].filter(Boolean).join(' · '),
      });
    });
  }
  if (exerciseRows.length) {
    await mapSb(supabase.from('program_exercises').insert(exerciseRows));
  }

  return created.id;
}

async function insertExercise(dayId: string, ex: WorkoutExercise, orderIndex: number) {
  const exerciseId =
    ex.matched_exercise_id ?? (await ensureCustomExercise(ex.name, ex.muscle_group));
  await supabase.from('program_exercises').insert({
    program_day_id: dayId,
    exercise_id: exerciseId,
    order_index: orderIndex,
    target_sets: ex.sets,
    target_reps: parseLowerRep(ex.rep_scheme),
    target_rpe: ex.target_rpe,
    rest_seconds: ex.rest_seconds,
    notes: [
      ex.is_warmup ? 'warmup' : null,
      ex.rep_scheme !== String(parseLowerRep(ex.rep_scheme)) ? `reps: ${ex.rep_scheme}` : null,
      ex.notes,
    ]
      .filter(Boolean)
      .join(' · '),
  });
}

async function _insertProgramExercise(
  dayId: string,
  ex: Program['days'][number]['exercises'][number],
  orderIndex: number,
) {
  const exerciseId = await ensureCustomExercise(ex.name, ex.muscle_group);
  const lower = parseLowerRep(ex.reps);
  await supabase.from('program_exercises').insert({
    program_day_id: dayId,
    exercise_id: exerciseId,
    order_index: orderIndex,
    target_sets: ex.sets,
    target_reps: lower,
    target_rpe: ex.rpe ?? null,
    rest_seconds: ex.rest_seconds,
    notes: [ex.reps !== String(lower) ? `reps: ${ex.reps}` : null, ex.notes]
      .filter(Boolean)
      .join(' · '),
  });
}

async function ensureCustomExercise(
  name: string,
  muscleGroup: string,
  userId?: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .or(`name_en.ilike.${name},name_fr.ilike.${name},name_ar.ilike.${name}`)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  let createdBy = userId;
  if (!createdBy) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    createdBy = user?.id;
  }
  if (!createdBy) throw new Error('unauthenticated');

  const created = (await mapSb(
    supabase
      .from('exercises')
      .insert({
        name_en: name,
        name_fr: name,
        name_ar: name,
        muscle_group: muscleGroup.toLowerCase(),
        equipment: 'unspecified',
        is_custom: true,
        created_by: createdBy,
      })
      .select('id')
      .single(),
  )) as { id: string };
  return created.id;
}
