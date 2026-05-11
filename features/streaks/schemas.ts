import { z } from 'zod';

/**
 * Weekday integer matches JS Date.getDay(): 0 = Sun, 1 = Mon, ... 6 = Sat.
 * The same convention is used by Postgres `extract(dow from date)`.
 */
export const weekday = z.number().int().min(0).max(6);
export type Weekday = z.infer<typeof weekday>;

export const userStreakRow = z.object({
  user_id: z.string().uuid(),
  current_streak: z.number().int().nonnegative(),
  longest_streak: z.number().int().nonnegative(),
  total_workouts_logged: z.number().int().nonnegative(),
  last_workout_date: z.string().nullable(),
  scheduled_days: z.array(weekday),
  is_flexible_schedule: z.boolean(),
  freezes_used_this_week: z.number().int().nonnegative(),
  freezes_available: z.number().int().nonnegative(),
  week_start_date: z.string(),
  current_week_completions: z.number().int().nonnegative(),
  current_week_target: z.number().int().min(1).max(7),
  is_recovery_week: z.boolean(),
  timezone: z.string().nullable(),
});
export type UserStreak = z.infer<typeof userStreakRow>;

export const streakEventType = z.enum([
  'completed',
  'bonus_completed',
  'freeze_used',
  'missed',
  'rest_day',
  'recovery_week',
  'week_completed',
  'reset',
  'milestone',
]);
export type StreakEventType = z.infer<typeof streakEventType>;

export const streakEventRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  event_date: z.string(), // ISO date (YYYY-MM-DD)
  event_type: streakEventType,
  workout_id: z.string().uuid().nullable(),
  notes: z.string().nullable(),
});
export type StreakEvent = z.infer<typeof streakEventRow>;

export const updateScheduleInput = z.object({
  scheduled_days: z.array(weekday).max(7),
  is_flexible_schedule: z.boolean(),
});
export type UpdateScheduleInput = z.infer<typeof updateScheduleInput>;
