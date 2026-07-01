import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import { LIFT_LIST, type LiftId } from '../config/lifts';
import {
  strengthEstimateRow,
  userBadgeRow,
  type StrengthEstimateRow,
  type UserBadgeRow,
} from '../schemas';

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** A logged set with the exercise it belongs to, for estimation. */
export interface MainLiftSetRow {
  exerciseId: string;
  weightKg: number;
  reps: number;
  performedAt: string;
  isWarmup: boolean;
}

/**
 * Resolve every visible exercise (the global library + the user's customs, per
 * RLS) to a canonical lift id. Exact `name_en` matches win; otherwise the
 * lift's lowercase substring matchers are tried, so a renamed custom "Comp Back
 * Squat" still maps to `squat`.
 */
export async function resolveExerciseLiftMap(): Promise<Map<string, LiftId>> {
  const { data, error } = await supabase.from('exercises').select('id,name_en');
  if (error) throw toAppError(error);

  const map = new Map<string, LiftId>();
  for (const row of data ?? []) {
    const name = (row.name_en ?? '').toLowerCase().trim();
    if (!name) continue;
    let matched: LiftId | null = null;
    for (const lift of LIFT_LIST) {
      const exact = lift.exerciseNames.some((n) => n.toLowerCase() === name);
      if (exact) {
        matched = lift.id;
        break;
      }
    }
    if (!matched) {
      for (const lift of LIFT_LIST) {
        if (lift.nameMatchers.some((m) => name.includes(m))) {
          matched = lift.id;
          break;
        }
      }
    }
    if (matched) map.set(row.id, matched);
  }
  return map;
}

/**
 * All working sets the user logged within `windowDays`, across the main lifts.
 * Filtering happens server-side on the parent workout's `started_at` via inner
 * joins, so we only pull the relevant rows.
 */
export async function fetchRecentMainLiftSets(
  userId: string,
  windowDays: number,
): Promise<MainLiftSetRow[]> {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('workout_sets')
    .select(
      'reps,weight_kg,is_warmup,completed_at,workout_exercises!inner(exercise_id,workouts!inner(user_id,started_at))',
    )
    .eq('workout_exercises.workouts.user_id', userId)
    .gte('workout_exercises.workouts.started_at', cutoff);
  if (error) throw toAppError(error);

  const rows: MainLiftSetRow[] = [];
  for (const r of (data ?? []) as unknown as RawSetJoin[]) {
    const we = r.workout_exercises;
    if (!we?.exercise_id) continue;
    rows.push({
      exerciseId: we.exercise_id,
      weightKg: Number(r.weight_kg) || 0,
      reps: Number(r.reps) || 0,
      performedAt: r.completed_at,
      isWarmup: !!r.is_warmup,
    });
  }
  return rows;
}

interface RawSetJoin {
  reps: number | string;
  weight_kg: number | string;
  is_warmup: boolean;
  completed_at: string;
  workout_exercises: { exercise_id: string | null } | null;
}

export async function fetchStrengthEstimates(userId: string): Promise<StrengthEstimateRow[]> {
  const { data, error } = await supabase
    .from('user_strength_estimates')
    .select(
      'user_id,lift_id,exercise_id,est_one_rm_kg,best_weight_kg,best_reps,level,bodyweight_ratio,bodyweight_kg,computed_at',
    )
    .eq('user_id', userId);
  if (error) throw toAppError(error);
  // Drop any rows whose lift_id is no longer a known canonical lift.
  return (data ?? [])
    .map((row) => strengthEstimateRow.safeParse(row))
    .filter((p): p is { success: true; data: StrengthEstimateRow } => p.success)
    .map((p) => p.data);
}

export type StrengthEstimateUpsert = Omit<StrengthEstimateRow, 'computed_at'> & {
  computed_at?: string;
};

export async function upsertStrengthEstimates(
  rows: readonly StrengthEstimateUpsert[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('user_strength_estimates')
    .upsert(rows as never, { onConflict: 'user_id,lift_id' });
  if (error) throw toAppError(error);
}

export async function fetchUserBadges(userId: string): Promise<UserBadgeRow[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('user_id,badge_id,earned_at,meta')
    .eq('user_id', userId);
  if (error) throw toAppError(error);
  return (data ?? []).map((row) => userBadgeRow.parse(row));
}

export interface BadgeAward {
  badge_id: string;
  meta?: Record<string, unknown> | null;
}

/**
 * Idempotently award badges: existing (user_id, badge_id) rows are left
 * untouched (`ignoreDuplicates`), so `earned_at` is never moved.
 */
export async function awardBadges(userId: string, awards: readonly BadgeAward[]): Promise<void> {
  if (awards.length === 0) return;
  const rows = awards.map((a) => ({
    user_id: userId,
    badge_id: a.badge_id,
    meta: a.meta ?? null,
  }));
  const { error } = await supabase
    .from('user_badges')
    .upsert(rows as never, { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
  if (error) throw toAppError(error);
}
