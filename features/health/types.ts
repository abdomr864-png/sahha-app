/**
 * Canonical, normalized health-data types for the Sahha aggregation layer.
 *
 * This layer sits on top of `@lib/health-data` (which wraps Apple HealthKit and
 * Android Health Connect) and mirrors normalized samples into Supabase
 * (`health_metrics`). Screens read the `health_daily` aggregate view, never the
 * device directly.
 */
import type { HealthDataType } from '@lib/health-data';

/**
 * Normalized metric identifiers stored in `health_metrics.metric_type`.
 *
 * HRV is intentionally split: Apple HealthKit reports **SDNN** while Android
 * Health Connect reports **RMSSD**. These are different measurements (both in
 * ms) and must never be averaged together — the variant is part of the type.
 */
export type MetricType =
  | 'steps'
  | 'distance'
  | 'active_minutes'
  | 'workout'
  | 'sleep'
  | 'resting_hr'
  | 'hrv_sdnn'
  | 'hrv_rmssd'
  | 'weight';

export const ALL_METRIC_TYPES: MetricType[] = [
  'steps',
  'distance',
  'active_minutes',
  'workout',
  'sleep',
  'resting_hr',
  'hrv_sdnn',
  'hrv_rmssd',
  'weight',
];

export type SourcePlatform = 'ios' | 'android';

/** A row in `health_metrics` (snake_case to match the table for upserts). */
export interface HealthMetricRow {
  user_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  start_time: string; // ISO-8601 UTC
  end_time: string | null;
  source: string | null;
  source_platform: SourcePlatform;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
}

/** A row from the `health_daily` view. */
export interface DailyMetric {
  metric_type: MetricType;
  day: string; // YYYY-MM-DD
  value: number;
  unit: string;
  sample_count: number;
}

/** Canonical unit per normalized metric. */
export const METRIC_UNITS: Record<MetricType, string> = {
  steps: 'count',
  distance: 'm',
  active_minutes: 'min',
  workout: 'session',
  sleep: 'min',
  resting_hr: 'bpm',
  hrv_sdnn: 'ms',
  hrv_rmssd: 'ms',
  weight: 'kg',
};

/** How `health_daily` aggregates each metric — kept in sync with the SQL view. */
export type Aggregation = 'sum' | 'count' | 'latest' | 'avg';
export const METRIC_AGGREGATION: Record<MetricType, Aggregation> = {
  steps: 'sum',
  distance: 'sum',
  active_minutes: 'sum',
  sleep: 'sum',
  workout: 'count',
  weight: 'latest',
  resting_hr: 'avg',
  hrv_sdnn: 'avg',
  hrv_rmssd: 'avg',
};

export type HealthPermissionStatus = 'not_determined' | 'denied' | 'granted' | 'partial';

export type HealthAvailability =
  | 'available'
  | 'unavailable' // platform has no health hub at all
  | 'needs_install'; // Android: Health Connect not installed (older OS)

export interface DateRange {
  from: string; // inclusive ISO-8601 UTC
  to: string; // exclusive ISO-8601 UTC
}

/** Result of a single syncAll() run. */
export interface HealthSyncResult {
  /** Rows upserted per metric type. */
  counts: Partial<Record<MetricType, number>>;
  /** Per-metric errors — sync continues on partial failure. */
  errors: Partial<Record<MetricType, string>>;
  syncedAt: string;
}

// --- Typed errors -----------------------------------------------------------

export type HealthErrorCode =
  | 'unavailable'
  | 'needs_install'
  | 'permission_denied'
  | 'not_authenticated'
  | 'read_failed'
  | 'persist_failed';

export class HealthError extends Error {
  readonly code: HealthErrorCode;
  constructor(code: HealthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'HealthError';
    this.code = code;
  }
}

/**
 * Privacy-policy URL shown when requesting health permissions. Apple and Google
 * BOTH require a privacy policy for health data access/review.
 *
 * TODO(privacy): replace with the live Sahha privacy-policy URL before release.
 */
export const HEALTH_PRIVACY_POLICY_URL = 'https://sahha.app/privacy'; // PLACEHOLDER

/**
 * Maps the provider-level `HealthDataType` (from @lib/health-data) to the set of
 * normalized metric types it can produce. `workouts` fans out into a synthetic
 * `active_minutes` + a `workout` count; `hrv` resolves to the platform variant
 * inside the mapper.
 */
export const PROVIDER_TYPES_FOR_SYNC: HealthDataType[] = [
  'steps',
  'resting_heart_rate',
  'hrv',
  'sleep',
  'workouts',
  'weight',
];
