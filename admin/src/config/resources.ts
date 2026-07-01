// Every admin-managed table is described here.
//
// Adding a new resource = one entry in `resources` + a sidebar link.
// The generic CrudPage reads this config to render list, filter, edit, and create UI.

export type FieldType =
  | 'uuid'
  | 'text'
  | 'longtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'enum'
  | 'array';

export interface FieldSpec {
  /** Column name in the table. */
  name: string;
  /** Optional display label (defaults to humanized name). */
  label?: string;
  type: FieldType;
  /** Enum values, for type: 'enum'. */
  options?: readonly string[];
  /** Hide from the list table (still shown in edit). */
  listHidden?: boolean;
  /** Hide from edit form (still shown in list). */
  editHidden?: boolean;
  /** Mark as required in edit form. */
  required?: boolean;
  /** Server-managed (created_at, updated_at, computed totals). Read-only. */
  readOnly?: boolean;
  /** Display width override for list cells. */
  truncate?: number;
}

export interface ResourceSpec {
  /** URL slug, must match the Postgres table name. */
  slug: string;
  /** Pretty title for headers. */
  title: string;
  /** Postgres table name (defaults to slug). */
  table?: string;
  /** Primary-key column (defaults to 'id'). Composite PKs not supported — list-only. */
  primaryKey?: string | string[];
  /** Default order column, prefixed with '-' for desc. */
  defaultOrder?: string;
  /** Columns. */
  fields: FieldSpec[];
  /** Search columns used by the freeform search box. */
  searchColumns?: string[];
  /** If true, do not expose insert/update/delete buttons. */
  readOnly?: boolean;
  /** Column used for "last 24h / 7d" stats. Falls back to created_at, then first
   *  datetime/date field in `fields`. */
  freshnessField?: string;
  /** Plural noun used in stats and empty states. Defaults to title.toLowerCase(). */
  noun?: string;
}

const id = (): FieldSpec => ({ name: 'id', type: 'uuid', readOnly: true });
const userId = (): FieldSpec => ({ name: 'user_id', type: 'uuid', required: true, truncate: 14 });
const createdAt = (): FieldSpec => ({
  name: 'created_at',
  type: 'datetime',
  readOnly: true,
});
const updatedAt = (): FieldSpec => ({
  name: 'updated_at',
  type: 'datetime',
  readOnly: true,
});

export const resources: ResourceSpec[] = [
  // ── profiles ──────────────────────────────────────────────────────────────
  {
    slug: 'profiles',
    title: 'Profiles',
    primaryKey: 'user_id',
    defaultOrder: '-created_at',
    searchColumns: ['username', 'display_name'],
    fields: [
      { name: 'user_id', type: 'uuid', required: true, readOnly: true, truncate: 14 },
      { name: 'username', type: 'text' },
      { name: 'display_name', type: 'text' },
      { name: 'avatar_url', type: 'text', listHidden: true },
      { name: 'locale', type: 'enum', options: ['en', 'fr', 'ar'] },
      { name: 'weight_unit', type: 'enum', options: ['kg', 'lb'] },
      { name: 'dob', type: 'date', listHidden: true },
      { name: 'sex', type: 'enum', options: ['male', 'female', 'other'] },
      { name: 'height_cm', type: 'number', listHidden: true },
      { name: 'weight_kg', type: 'number' },
      {
        name: 'goal',
        type: 'enum',
        options: ['hypertrophy', 'strength', 'recomp', 'general'],
      },
      {
        name: 'experience_level',
        type: 'enum',
        options: ['beginner', 'intermediate', 'advanced'],
      },
      { name: 'training_days_per_week', type: 'number' },
      {
        name: 'equipment_access',
        type: 'enum',
        options: ['full_gym', 'home_gym', 'minimal'],
      },
      { name: 'bio', type: 'longtext', listHidden: true },
      { name: 'is_public', type: 'boolean' },
      createdAt(),
      updatedAt(),
    ],
  },
  // ── exercises ─────────────────────────────────────────────────────────────
  {
    slug: 'exercises',
    title: 'Exercises',
    defaultOrder: 'name_en',
    searchColumns: ['name_en', 'name_fr', 'name_ar', 'muscle_group', 'equipment'],
    fields: [
      id(),
      { name: 'name_en', type: 'text', required: true },
      { name: 'name_fr', type: 'text', required: true },
      { name: 'name_ar', type: 'text', required: true },
      { name: 'muscle_group', type: 'text', required: true },
      { name: 'secondary_muscles', type: 'array', listHidden: true },
      { name: 'equipment', type: 'text', required: true },
      { name: 'instructions_en', type: 'longtext', listHidden: true },
      { name: 'instructions_fr', type: 'longtext', listHidden: true },
      { name: 'instructions_ar', type: 'longtext', listHidden: true },
      { name: 'video_url', type: 'text', listHidden: true },
      { name: 'is_custom', type: 'boolean' },
      { name: 'created_by', type: 'uuid', truncate: 14 },
      createdAt(),
    ],
  },
  // ── programs ──────────────────────────────────────────────────────────────
  {
    slug: 'programs',
    title: 'Programs',
    defaultOrder: '-created_at',
    searchColumns: ['name'],
    fields: [
      id(),
      userId(),
      { name: 'name', type: 'text', required: true },
      {
        name: 'goal',
        type: 'enum',
        options: ['hypertrophy', 'strength', 'recomp', 'general'],
      },
      { name: 'weeks', type: 'number' },
      { name: 'days_per_week', type: 'number' },
      { name: 'is_template', type: 'boolean' },
      { name: 'is_ai_generated', type: 'boolean' },
      { name: 'source', type: 'text' },
      createdAt(),
    ],
  },
  {
    slug: 'program_days',
    title: 'Program Days',
    defaultOrder: 'program_id',
    fields: [
      id(),
      { name: 'program_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'week', type: 'number', required: true },
      { name: 'day_index', type: 'number', required: true },
      { name: 'name', type: 'text' },
    ],
  },
  {
    slug: 'program_exercises',
    title: 'Program Exercises',
    fields: [
      id(),
      { name: 'program_day_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'exercise_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'order_index', type: 'number', required: true },
      { name: 'target_sets', type: 'number' },
      { name: 'target_reps', type: 'number' },
      { name: 'target_rpe', type: 'number' },
      { name: 'rest_seconds', type: 'number' },
      { name: 'notes', type: 'longtext', listHidden: true },
      { name: 'progression_model', type: 'json', listHidden: true },
    ],
  },
  // ── workouts ──────────────────────────────────────────────────────────────
  {
    slug: 'workouts',
    title: 'Workouts',
    defaultOrder: '-started_at',
    searchColumns: ['name'],
    fields: [
      id(),
      userId(),
      { name: 'program_day_id', type: 'uuid', truncate: 14 },
      { name: 'name', type: 'text' },
      { name: 'started_at', type: 'datetime' },
      { name: 'ended_at', type: 'datetime' },
      { name: 'total_volume_kg', type: 'number', readOnly: true },
      { name: 'notes', type: 'longtext', listHidden: true },
      createdAt(),
    ],
  },
  {
    slug: 'workout_exercises',
    title: 'Workout Exercises',
    fields: [
      id(),
      { name: 'workout_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'exercise_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'order_index', type: 'number', required: true },
    ],
  },
  {
    slug: 'workout_sets',
    title: 'Workout Sets',
    defaultOrder: '-completed_at',
    fields: [
      id(),
      { name: 'workout_exercise_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'set_index', type: 'number', required: true },
      { name: 'reps', type: 'number', required: true },
      { name: 'weight_kg', type: 'number', required: true },
      { name: 'rpe', type: 'number' },
      { name: 'is_warmup', type: 'boolean' },
      { name: 'is_drop_set', type: 'boolean' },
      { name: 'completed_at', type: 'datetime' },
    ],
  },
  // ── progress ──────────────────────────────────────────────────────────────
  {
    slug: 'personal_records',
    title: 'Personal Records',
    defaultOrder: '-achieved_at',
    fields: [
      id(),
      userId(),
      { name: 'exercise_id', type: 'uuid', required: true, truncate: 14 },
      {
        name: 'record_type',
        type: 'enum',
        options: ['max_weight_at_reps', 'est_one_rm', 'max_set_volume'],
        required: true,
      },
      { name: 'value', type: 'number', required: true },
      { name: 'unit', type: 'text' },
      { name: 'reps', type: 'number' },
      { name: 'achieved_at', type: 'datetime' },
      { name: 'workout_set_id', type: 'uuid', truncate: 14, listHidden: true },
    ],
  },
  {
    slug: 'body_measurements',
    title: 'Body Measurements',
    defaultOrder: '-recorded_at',
    fields: [
      id(),
      userId(),
      { name: 'weight_kg', type: 'number' },
      { name: 'body_fat_pct', type: 'number' },
      { name: 'chest_cm', type: 'number' },
      { name: 'waist_cm', type: 'number' },
      { name: 'arm_cm', type: 'number' },
      { name: 'thigh_cm', type: 'number' },
      { name: 'recorded_at', type: 'datetime' },
    ],
  },
  {
    slug: 'progress_photos',
    title: 'Progress Photos',
    defaultOrder: '-recorded_at',
    fields: [
      id(),
      userId(),
      { name: 'photo_url', type: 'text', required: true },
      { name: 'pose', type: 'text' },
      { name: 'recorded_at', type: 'datetime' },
      { name: 'is_private', type: 'boolean' },
    ],
  },
  // ── nutrition ─────────────────────────────────────────────────────────────
  {
    slug: 'foods',
    title: 'Foods',
    defaultOrder: 'name',
    searchColumns: ['name', 'brand', 'barcode'],
    fields: [
      id(),
      { name: 'name', type: 'text', required: true },
      { name: 'brand', type: 'text' },
      { name: 'calories', type: 'number' },
      { name: 'protein_g', type: 'number' },
      { name: 'carbs_g', type: 'number' },
      { name: 'fat_g', type: 'number' },
      { name: 'serving_size_g', type: 'number' },
      { name: 'source', type: 'text' },
      { name: 'barcode', type: 'text' },
    ],
  },
  {
    slug: 'meals',
    title: 'Meals',
    defaultOrder: '-eaten_at',
    fields: [
      id(),
      userId(),
      { name: 'name', type: 'text' },
      {
        name: 'meal_type',
        type: 'enum',
        options: ['breakfast', 'lunch', 'dinner', 'snack'],
      },
      { name: 'eaten_at', type: 'datetime' },
    ],
  },
  {
    slug: 'meal_items',
    title: 'Meal Items',
    fields: [
      id(),
      { name: 'meal_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'food_id', type: 'uuid', truncate: 14 },
      { name: 'custom_name', type: 'text' },
      { name: 'calories', type: 'number' },
      { name: 'protein_g', type: 'number' },
      { name: 'carbs_g', type: 'number' },
      { name: 'fat_g', type: 'number' },
      { name: 'quantity_g', type: 'number' },
    ],
  },
  {
    slug: 'water_log',
    title: 'Water Log',
    defaultOrder: '-logged_at',
    fields: [
      id(),
      userId(),
      { name: 'amount_ml', type: 'number', required: true },
      { name: 'logged_at', type: 'datetime' },
    ],
  },
  {
    slug: 'supplements',
    title: 'Supplements',
    defaultOrder: '-created_at',
    fields: [
      id(),
      userId(),
      { name: 'name', type: 'text', required: true },
      { name: 'dosage', type: 'text' },
      { name: 'frequency', type: 'text' },
      { name: 'times', type: 'json', listHidden: true },
      { name: 'active', type: 'boolean' },
      createdAt(),
    ],
  },
  {
    slug: 'supplement_logs',
    title: 'Supplement Logs',
    defaultOrder: '-taken_at',
    fields: [
      id(),
      userId(),
      { name: 'supplement_id', type: 'uuid', truncate: 14 },
      { name: 'taken_at', type: 'datetime' },
      { name: 'skipped', type: 'boolean' },
    ],
  },
  // ── wellness ─────────────────────────────────────────────────────────────
  {
    slug: 'mood_log',
    title: 'Mood Log',
    defaultOrder: '-logged_at',
    fields: [
      id(),
      userId(),
      { name: 'mood', type: 'number' },
      { name: 'energy', type: 'number' },
      { name: 'stress', type: 'number' },
      { name: 'note', type: 'longtext', listHidden: true },
      { name: 'logged_at', type: 'datetime' },
    ],
  },
  {
    slug: 'sleep_log',
    title: 'Sleep Log',
    defaultOrder: '-started_at',
    fields: [
      id(),
      userId(),
      { name: 'started_at', type: 'datetime', required: true },
      { name: 'ended_at', type: 'datetime', required: true },
      { name: 'quality_score', type: 'number' },
    ],
  },
  {
    slug: 'wearable_metrics',
    title: 'Wearable Metrics',
    defaultOrder: '-recorded_at',
    fields: [
      id(),
      userId(),
      {
        name: 'source',
        type: 'enum',
        options: ['apple_health', 'google_fit', 'manual'],
        required: true,
      },
      { name: 'metric_type', type: 'text', required: true },
      { name: 'value', type: 'number', required: true },
      { name: 'unit', type: 'text', required: true },
      { name: 'recorded_at', type: 'datetime', required: true },
    ],
  },
  // ── social ────────────────────────────────────────────────────────────────
  {
    slug: 'follows',
    title: 'Follows',
    primaryKey: ['follower_id', 'followed_id'],
    defaultOrder: '-created_at',
    readOnly: true,
    fields: [
      { name: 'follower_id', type: 'uuid', truncate: 14 },
      { name: 'followed_id', type: 'uuid', truncate: 14 },
      createdAt(),
    ],
  },
  {
    slug: 'posts',
    title: 'Posts',
    defaultOrder: '-created_at',
    fields: [
      id(),
      userId(),
      {
        name: 'type',
        type: 'enum',
        options: ['workout', 'pr', 'photo', 'text'],
        required: true,
      },
      { name: 'workout_id', type: 'uuid', truncate: 14 },
      { name: 'content', type: 'longtext' },
      createdAt(),
    ],
  },
  {
    slug: 'post_likes',
    title: 'Post Likes',
    primaryKey: ['post_id', 'user_id'],
    readOnly: true,
    fields: [
      { name: 'post_id', type: 'uuid', truncate: 14 },
      { name: 'user_id', type: 'uuid', truncate: 14 },
      createdAt(),
    ],
  },
  {
    slug: 'post_comments',
    title: 'Post Comments',
    defaultOrder: '-created_at',
    fields: [
      id(),
      { name: 'post_id', type: 'uuid', required: true, truncate: 14 },
      userId(),
      { name: 'content', type: 'longtext', required: true },
      createdAt(),
    ],
  },
  {
    slug: 'leaderboards_weekly',
    title: 'Leaderboards (Weekly)',
    defaultOrder: '-week_start',
    fields: [
      id(),
      userId(),
      { name: 'metric', type: 'text', required: true },
      { name: 'value', type: 'number', required: true },
      { name: 'week_start', type: 'date', required: true },
      { name: 'rank', type: 'number', required: true },
    ],
  },
  // ── AI ────────────────────────────────────────────────────────────────────
  {
    slug: 'ai_conversations',
    title: 'AI Conversations',
    defaultOrder: '-last_message_at',
    searchColumns: ['title'],
    fields: [
      id(),
      userId(),
      { name: 'title', type: 'text' },
      createdAt(),
      { name: 'last_message_at', type: 'datetime' },
    ],
  },
  {
    slug: 'ai_messages',
    title: 'AI Messages',
    defaultOrder: '-created_at',
    fields: [
      id(),
      { name: 'conversation_id', type: 'uuid', required: true, truncate: 14 },
      userId(),
      {
        name: 'role',
        type: 'enum',
        options: ['user', 'assistant', 'system'],
        required: true,
      },
      { name: 'content', type: 'longtext', required: true, truncate: 80 },
      { name: 'tokens_used', type: 'number' },
      createdAt(),
    ],
  },
  {
    slug: 'ai_form_checks',
    title: 'AI Form Checks',
    defaultOrder: '-created_at',
    fields: [
      id(),
      userId(),
      { name: 'exercise_id', type: 'uuid', truncate: 14 },
      { name: 'video_url', type: 'text', required: true },
      { name: 'feedback', type: 'longtext', listHidden: true },
      createdAt(),
    ],
  },
  {
    slug: 'ai_program_adjustments',
    title: 'AI Program Adjustments',
    defaultOrder: '-created_at',
    fields: [
      id(),
      userId(),
      { name: 'program_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'week', type: 'number', required: true },
      { name: 'suggestion', type: 'json', listHidden: true },
      { name: 'applied', type: 'boolean' },
      createdAt(),
    ],
  },
  // ── streaks & progression ────────────────────────────────────────────────
  {
    slug: 'user_streaks',
    title: 'User Streaks',
    primaryKey: 'user_id',
    defaultOrder: '-current_streak',
    fields: [
      { name: 'user_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'current_streak', type: 'number' },
      { name: 'longest_streak', type: 'number' },
      { name: 'total_workouts_logged', type: 'number' },
      { name: 'last_workout_date', type: 'date' },
      { name: 'scheduled_days', type: 'array', listHidden: true },
      { name: 'is_flexible_schedule', type: 'boolean' },
      { name: 'freezes_used_this_week', type: 'number' },
      { name: 'freezes_available', type: 'number' },
      { name: 'week_start_date', type: 'date' },
      { name: 'current_week_completions', type: 'number' },
      { name: 'current_week_target', type: 'number' },
      { name: 'is_recovery_week', type: 'boolean' },
      { name: 'timezone', type: 'text' },
      { name: 'last_resolved_date', type: 'date', listHidden: true },
      updatedAt(),
    ],
  },
  {
    slug: 'streak_events',
    title: 'Streak Events',
    defaultOrder: '-event_date',
    fields: [
      id(),
      userId(),
      { name: 'event_date', type: 'date', required: true },
      {
        name: 'event_type',
        type: 'enum',
        options: [
          'completed',
          'bonus_completed',
          'freeze_used',
          'missed',
          'rest_day',
          'recovery_week',
          'week_completed',
          'reset',
          'milestone',
        ],
        required: true,
      },
      { name: 'workout_id', type: 'uuid', truncate: 14 },
      { name: 'notes', type: 'text' },
      createdAt(),
    ],
  },
  {
    slug: 'exercise_progression_log',
    title: 'Progression Log',
    defaultOrder: '-decided_at',
    fields: [
      id(),
      userId(),
      { name: 'exercise_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'program_exercise_id', type: 'uuid', truncate: 14 },
      {
        name: 'event_type',
        type: 'enum',
        options: [
          'reps_increased',
          'sets_increased',
          'weight_suggested',
          'weight_accepted',
          'weight_declined',
          'deload_suggested',
          'pr_prompt',
          'held',
        ],
        required: true,
      },
      { name: 'from_value', type: 'json', listHidden: true },
      { name: 'to_value', type: 'json', listHidden: true },
      { name: 'rpe_evidence', type: 'json', listHidden: true },
      { name: 'decided_at', type: 'datetime' },
    ],
  },
  {
    slug: 'next_session_suggestions',
    title: 'Next Session Suggestions',
    defaultOrder: '-created_at',
    fields: [
      id(),
      userId(),
      { name: 'exercise_id', type: 'uuid', required: true, truncate: 14 },
      { name: 'program_exercise_id', type: 'uuid', truncate: 14 },
      { name: 'suggested_weight_kg', type: 'number' },
      { name: 'suggested_reps', type: 'number' },
      { name: 'suggested_sets', type: 'number' },
      { name: 'reasoning', type: 'longtext', listHidden: true },
      { name: 'is_pr_attempt', type: 'boolean' },
      { name: 'rpe_evidence', type: 'json', listHidden: true },
      createdAt(),
      { name: 'expires_at', type: 'datetime' },
      { name: 'consumed_at', type: 'datetime' },
      {
        name: 'consumed_decision',
        type: 'enum',
        options: ['accepted', 'declined'],
      },
    ],
  },
  // ── billing ──────────────────────────────────────────────────────────────
  {
    slug: 'subscriptions',
    title: 'Subscriptions',
    defaultOrder: '-updated_at',
    fields: [
      id(),
      userId(),
      {
        name: 'plan',
        type: 'enum',
        options: ['free', 'premium_monthly', 'premium_yearly'],
        required: true,
      },
      {
        name: 'status',
        type: 'enum',
        options: ['active', 'trialing', 'past_due', 'canceled', 'expired'],
        required: true,
      },
      { name: 'started_at', type: 'datetime' },
      { name: 'expires_at', type: 'datetime' },
      { name: 'provider_customer_id', type: 'text' },
      updatedAt(),
    ],
  },
  {
    slug: 'usage_counters',
    title: 'Usage Counters',
    defaultOrder: '-period_start',
    fields: [
      id(),
      userId(),
      { name: 'feature', type: 'text', required: true },
      { name: 'period_start', type: 'date', required: true },
      { name: 'count', type: 'number' },
    ],
  },
  {
    slug: 'entitlement_rules',
    title: 'Entitlement Rules',
    primaryKey: 'feature',
    defaultOrder: 'feature',
    fields: [
      { name: 'feature', type: 'text', required: true },
      { name: 'free_daily_limit', type: 'number' },
      { name: 'free_total_limit', type: 'number' },
      { name: 'premium_only', type: 'boolean' },
      { name: 'description', type: 'longtext' },
    ],
  },
  {
    slug: 'plans',
    title: 'Plans',
    primaryKey: 'id',
    defaultOrder: 'sort_order',
    searchColumns: ['id', 'name'],
    fields: [
      { name: 'id', type: 'text', required: true },
      { name: 'name', type: 'text', required: true },
      { name: 'description', type: 'text', listHidden: true },
      { name: 'price', type: 'number', required: true },
      { name: 'currency', type: 'text' },
      { name: 'billing_interval', type: 'enum', options: ['month', 'year', 'one_time'] },
      {
        name: 'sub_plan',
        type: 'enum',
        options: ['free', 'premium_monthly', 'premium_yearly'],
      },
      { name: 'features', type: 'json', listHidden: true },
      { name: 'feature_limits', type: 'json', listHidden: true },
      { name: 'badge', type: 'text' },
      { name: 'highlight', type: 'boolean' },
      { name: 'is_active', type: 'boolean' },
      { name: 'sort_order', type: 'number' },
      createdAt(),
      updatedAt(),
    ],
  },
];

export function getResource(slug: string): ResourceSpec | undefined {
  return resources.find((r) => r.slug === slug);
}

/** Resolve the column used for "last 24h" stats. */
export function freshnessColumn(spec: ResourceSpec): string | null {
  if (spec.freshnessField) return spec.freshnessField;
  const names = new Set(spec.fields.map((f) => f.name));
  if (names.has('created_at')) return 'created_at';
  const first = spec.fields.find(
    (f) => (f.type === 'datetime' || f.type === 'date') && !f.readOnly === false,
  );
  return first?.name ?? null;
}
