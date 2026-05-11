// Rich user-context fetcher used by ai-generate-workout and ai-generate-program.
// Fans out parallel queries across profiles, workouts/sets, sleep_log, mood_log,
// meal_items, and personal_records, then folds them into a single
// `UserTrainingContext` shape consumed by the prompt builder.
//
// Sleep quality / mood / energy / stress are stored on a 1..5 scale; this
// helper rescales them to 1..10 to match the prompt's wording (D36).

// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  UserTrainingContext,
  MuscleVolumeRow,
  PrRow,
} from '../../../lib/llm/prompts/user-context-block.ts';

const MS_PER_HOUR = 3600 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * MS_PER_DAY));
}

function rescale1to10(v: number | null | undefined): number | null {
  if (v == null) return null;
  return Math.max(1, Math.min(10, v * 2));
}

function estimateKcalTarget(p: {
  sex?: string | null;
  age?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  goal?: string | null;
  training_days_per_week?: number | null;
}): number | null {
  if (!p.weight_kg || !p.height_cm || !p.age || !p.sex) return null;
  const s = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + s;
  const tdee = bmr * (p.training_days_per_week && p.training_days_per_week >= 4 ? 1.55 : 1.4);
  if (p.goal === 'recomp' || p.goal === 'fat_loss') return Math.round(tdee - 350);
  if (p.goal === 'hypertrophy' || p.goal === 'muscle_gain') return Math.round(tdee + 250);
  return Math.round(tdee);
}

async function fetchProfile(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('profiles')
    .select(
      'goal, experience_level, weight_kg, height_cm, sex, dob, equipment_access, injuries, training_days_per_week',
    )
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

async function fetchTraining(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('workouts')
    .select(
      `id, started_at,
      workout_exercises:workout_exercises(
        exercises:exercises(muscle_group),
        workout_sets:workout_sets(reps, weight_kg, rpe, is_warmup)
      )`,
    )
    .eq('user_id', userId)
    .gte('started_at', isoDaysAgo(7));
  return (data ?? []) as any[];
}

async function fetchSleep(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('sleep_log')
    .select('started_at, ended_at, quality_score')
    .eq('user_id', userId)
    .gte('started_at', isoDaysAgo(3));
  return (data ?? []) as any[];
}

async function fetchMood(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('mood_log')
    .select('mood, energy, stress, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', isoDaysAgo(3));
  return (data ?? []) as any[];
}

async function fetchTodayNutrition(admin: SupabaseClient, userId: string) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { data: meals } = await admin
    .from('meals')
    .select('id, meal_items:meal_items(calories, protein_g)')
    .eq('user_id', userId)
    .gte('eaten_at', dayStart.toISOString());
  let calories = 0;
  let protein = 0;
  for (const m of (meals ?? []) as any[]) {
    for (const it of (m.meal_items ?? []) as any[]) {
      calories += Number(it.calories ?? 0);
      protein += Number(it.protein_g ?? 0);
    }
  }
  return { calories: Math.round(calories), protein: Math.round(protein) };
}

async function fetchRecentPRs(admin: SupabaseClient, userId: string): Promise<PrRow[]> {
  const { data } = await admin
    .from('personal_records')
    .select('record_type, value, unit, achieved_at, exercises:exercises(name_en, name_fr, name_ar)')
    .eq('user_id', userId)
    .gte('achieved_at', isoDaysAgo(30))
    .order('achieved_at', { ascending: false })
    .limit(8);
  return ((data ?? []) as any[]).map((r) => ({
    exercise_name: r.exercises?.name_en ?? 'unknown',
    pr_type: r.record_type,
    value: Number(r.value),
    unit: r.unit ?? 'kg',
    achieved_at: r.achieved_at,
  }));
}

function summariseTraining(workouts: any[]): {
  workouts_completed: number;
  muscles: MuscleVolumeRow[];
  avg_rpe: number | null;
  hours_since_last: number | null;
} {
  const muscleMap = new Map<string, { sets: number; volume: number }>();
  const rpes: number[] = [];
  let lastStart: number | null = null;
  for (const w of workouts) {
    const t = new Date(w.started_at).getTime();
    if (lastStart == null || t > lastStart) lastStart = t;
    for (const we of w.workout_exercises ?? []) {
      const muscle = we.exercises?.muscle_group ?? 'unknown';
      const cur = muscleMap.get(muscle) ?? { sets: 0, volume: 0 };
      for (const s of we.workout_sets ?? []) {
        if (s.is_warmup) continue;
        cur.sets += 1;
        cur.volume += Number(s.weight_kg ?? 0) * Number(s.reps ?? 0);
        if (s.rpe != null) rpes.push(Number(s.rpe));
      }
      muscleMap.set(muscle, cur);
    }
  }
  const muscles: MuscleVolumeRow[] = Array.from(muscleMap.entries())
    .map(([muscle_group, v]) => ({ muscle_group, total_sets: v.sets, total_volume_kg: v.volume }))
    .filter((m) => m.total_sets > 0)
    .sort((a, b) => b.total_sets - a.total_sets);
  const avg_rpe = rpes.length ? rpes.reduce((s, x) => s + x, 0) / rpes.length : null;
  const hours_since_last = lastStart != null ? (Date.now() - lastStart) / MS_PER_HOUR : null;
  return { workouts_completed: workouts.length, muscles, avg_rpe, hours_since_last };
}

function avg(xs: (number | null | undefined)[]): number | null {
  const ys = xs.filter((x): x is number => typeof x === 'number');
  return ys.length ? ys.reduce((s, x) => s + x, 0) / ys.length : null;
}

export async function fetchUserTrainingContext(
  admin: SupabaseClient,
  userId: string,
): Promise<UserTrainingContext> {
  const [profile, training, sleep, mood, nutrition, prs] = await Promise.all([
    fetchProfile(admin, userId).catch(() => null),
    fetchTraining(admin, userId).catch(() => [] as any[]),
    fetchSleep(admin, userId).catch(() => [] as any[]),
    fetchMood(admin, userId).catch(() => [] as any[]),
    fetchTodayNutrition(admin, userId).catch(() => ({ calories: 0, protein: 0 })),
    fetchRecentPRs(admin, userId).catch(() => [] as PrRow[]),
  ]);

  const age = ageFromDob(profile?.dob);
  const sleepHours = sleep.map((s) => {
    const start = new Date(s.started_at).getTime();
    const end = new Date(s.ended_at).getTime();
    return Math.max(0, (end - start) / MS_PER_HOUR);
  });
  const sleepQualities = sleep.map((s) => s.quality_score as number | null);
  const moodVals = mood.map((m) => m.mood as number | null);
  const energyVals = mood.map((m) => m.energy as number | null);
  const stressVals = mood.map((m) => m.stress as number | null);
  const trainingSummary = summariseTraining(training);

  const kcalTarget = estimateKcalTarget({
    sex: profile?.sex,
    age,
    height_cm: profile?.height_cm,
    weight_kg: profile?.weight_kg,
    goal: profile?.goal,
    training_days_per_week: profile?.training_days_per_week,
  });
  const proteinTarget = profile?.weight_kg ? Math.round(profile.weight_kg * 1.8) : null;

  return {
    goal: profile?.goal ?? null,
    experience: profile?.experience_level ?? null,
    bodyweight_kg: profile?.weight_kg ?? null,
    height_cm: profile?.height_cm ?? null,
    sex: profile?.sex ?? null,
    age,
    equipment: profile?.equipment_access ?? null,
    injuries: (profile?.injuries as string[] | null) ?? null,
    workouts_completed_7d: trainingSummary.workouts_completed,
    muscles_trained_7d: trainingSummary.muscles,
    avg_rpe_7d: trainingSummary.avg_rpe,
    hours_since_last_workout: trainingSummary.hours_since_last,
    avg_sleep_hours_3d: avg(sleepHours),
    avg_sleep_quality_10: rescale1to10(avg(sleepQualities)),
    avg_mood_10: rescale1to10(avg(moodVals)),
    avg_energy_10: rescale1to10(avg(energyVals)),
    avg_stress_10: rescale1to10(avg(stressVals)),
    today_calories: nutrition.calories || null,
    target_calories: kcalTarget,
    today_protein_g: nutrition.protein || null,
    target_protein_g: proteinTarget,
    recent_prs: prs,
  };
}
