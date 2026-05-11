// Extra (non-auto-derivable) insight specs per resource.
// Enum-distribution and boolean-split panels are auto-derived from the resource's
// fields; this file adds the things you can't infer: top-N groupings, averages,
// top-users leaderboards.

import type { InsightSpec } from '@/components/data/AutoInsights';

export const extraInsights: Record<string, InsightSpec[]> = {
  profiles: [
    { kind: 'avg', column: 'weight_kg', label: 'Weight', suffix: 'kg', tone: 'emerald' },
    { kind: 'avg', column: 'height_cm', label: 'Height', suffix: 'cm', tone: 'cyan' },
    {
      kind: 'avg',
      column: 'training_days_per_week',
      label: 'Training days/week',
      suffix: 'days',
      tone: 'amber',
    },
  ],
  programs: [{ kind: 'avg', column: 'weeks', label: 'Weeks', tone: 'blue' }],
  program_days: [
    {
      kind: 'topusers',
      label: 'Top programs by day count',
      column: 'program_id',
      tone: 'blue',
      span: 2,
    },
  ],
  program_exercises: [
    {
      kind: 'topusers',
      label: 'Most-used exercises in programs',
      column: 'exercise_id',
      tone: 'emerald',
      span: 2,
    },
    { kind: 'avg', column: 'target_reps', label: 'Target reps', tone: 'blue' },
  ],
  workout_exercises: [
    {
      kind: 'topusers',
      label: 'Most-logged exercises',
      column: 'exercise_id',
      tone: 'emerald',
      span: 2,
    },
  ],
  workout_sets: [
    { kind: 'avg', column: 'reps', label: 'Reps', tone: 'emerald' },
    { kind: 'avg', column: 'weight_kg', label: 'Weight', suffix: 'kg', tone: 'emerald' },
    { kind: 'avg', column: 'rpe', label: 'RPE', tone: 'amber' },
  ],
  personal_records: [
    {
      kind: 'topusers',
      label: 'Most-PRed exercises',
      column: 'exercise_id',
      tone: 'amber',
      span: 2,
    },
    { kind: 'topusers', label: 'Top users by PR count', tone: 'emerald' },
  ],
  body_measurements: [
    { kind: 'avg', column: 'weight_kg', label: 'Weight', suffix: 'kg', tone: 'emerald' },
    { kind: 'avg', column: 'body_fat_pct', label: 'Body fat', suffix: '%', tone: 'amber' },
    { kind: 'avg', column: 'waist_cm', label: 'Waist', suffix: 'cm', tone: 'cyan' },
  ],
  progress_photos: [{ kind: 'topvals', column: 'pose', label: 'Poses', tone: 'pink' }],
  meals: [{ kind: 'topusers', label: 'Top meal loggers', tone: 'amber' }],
  meal_items: [
    { kind: 'topusers', label: 'Most-eaten foods', column: 'food_id', tone: 'amber', span: 2 },
    { kind: 'avg', column: 'calories', label: 'Calories', suffix: 'kcal', tone: 'amber' },
  ],
  water_log: [
    { kind: 'avg', column: 'amount_ml', label: 'Amount', suffix: 'ml', tone: 'cyan' },
    { kind: 'topusers', label: 'Top water trackers', tone: 'cyan', span: 2 },
  ],
  supplements: [
    { kind: 'topvals', column: 'name', label: 'Top supplement names', tone: 'violet', span: 2 },
  ],
  supplement_logs: [{ kind: 'topusers', label: 'Top supplement loggers', tone: 'violet' }],
  mood_log: [
    { kind: 'avg', column: 'mood', label: 'Mood', tone: 'rose' },
    { kind: 'avg', column: 'energy', label: 'Energy', tone: 'emerald' },
    { kind: 'avg', column: 'stress', label: 'Stress', tone: 'amber' },
  ],
  sleep_log: [
    { kind: 'avg', column: 'quality_score', label: 'Sleep quality', tone: 'indigo' },
    { kind: 'topusers', label: 'Top sleep loggers', tone: 'indigo', span: 2 },
  ],
  wearable_metrics: [
    { kind: 'topvals', column: 'metric_type', label: 'Top metric types', tone: 'cyan', span: 2 },
  ],
  follows: [
    {
      kind: 'topusers',
      label: 'Most-followed users',
      column: 'followed_id',
      tone: 'blue',
      span: 2,
    },
    { kind: 'topusers', label: 'Top followers', column: 'follower_id', tone: 'blue' },
  ],
  posts: [{ kind: 'topusers', label: 'Most active posters', tone: 'blue' }],
  post_likes: [
    { kind: 'topusers', label: 'Most-liked posts', column: 'post_id', tone: 'rose', span: 2 },
    { kind: 'topusers', label: 'Top likers', tone: 'rose' },
  ],
  post_comments: [
    { kind: 'topusers', label: 'Most-commented posts', column: 'post_id', tone: 'blue', span: 2 },
    { kind: 'topusers', label: 'Top commenters', tone: 'blue' },
  ],
  leaderboards_weekly: [
    { kind: 'topvals', column: 'metric', label: 'Metrics tracked', tone: 'amber', span: 2 },
  ],
  ai_conversations: [
    { kind: 'avg', column: 'message_count', label: 'Messages / conversation', tone: 'violet' },
    { kind: 'topusers', label: 'Top AI users', tone: 'violet', span: 2 },
  ],
  ai_form_checks: [
    {
      kind: 'topusers',
      label: 'Most-checked exercises',
      column: 'exercise_id',
      tone: 'pink',
      span: 2,
    },
    { kind: 'topusers', label: 'Top form-check users', tone: 'pink' },
  ],
  ai_program_adjustments: [{ kind: 'avg', column: 'week', label: 'Week #', tone: 'violet' }],
  exercise_progression_log: [
    { kind: 'topusers', label: 'Top users by progression events', tone: 'cyan', span: 2 },
  ],
  next_session_suggestions: [
    {
      kind: 'topusers',
      label: 'Most-suggested exercises',
      column: 'exercise_id',
      tone: 'violet',
      span: 2,
    },
    {
      kind: 'avg',
      column: 'suggested_weight_kg',
      label: 'Suggested weight',
      suffix: 'kg',
      tone: 'violet',
    },
  ],
  usage_counters: [
    { kind: 'topvals', column: 'feature', label: 'Top features by usage', tone: 'blue', span: 2 },
    { kind: 'avg', column: 'count', label: 'Count per row', tone: 'blue' },
  ],
  streak_events: [{ kind: 'topusers', label: 'Most-active streak users', tone: 'amber' }],
};
