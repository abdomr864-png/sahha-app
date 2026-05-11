/**
 * Platform-agnostic surface over Apple HealthKit (iOS) and Android Health
 * Connect. Implementations must never throw on permission denial — return
 * `denied` instead. All timestamps are ISO-8601 UTC.
 */

export type HealthSource = 'apple_health' | 'health_connect' | 'manual' | 'mock';

export type HealthDataType =
  | 'steps'
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'hrv'
  | 'active_calories'
  | 'total_calories'
  | 'sleep'
  | 'workouts'
  | 'weight'
  | 'body_fat';

export interface DateRange {
  /** Inclusive UTC ISO-8601. */
  from: string;
  /** Exclusive UTC ISO-8601. */
  to: string;
}

export type HealthAuthStatus = 'not_determined' | 'denied' | 'granted';

export interface PermissionResult {
  status: HealthAuthStatus;
  /** Per-type grant status. May be partial. */
  granted: Partial<Record<HealthDataType, boolean>>;
}

export interface HealthSample {
  /** Stable per-source ID; used for idempotent upserts. */
  sourceUuid: string;
  /** UTC ISO-8601 instant the value applies to. */
  recordedAt: string;
  /** Local-time mirror — display only, never used for de-dup. */
  recordedAtLocal?: string;
  /** Numeric value in canonical units (see metric → unit map below). */
  value: number;
  unit: string;
  deviceName?: string;
  metadata?: Record<string, unknown>;
}

export interface SleepSample {
  sourceUuid: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  inBedMinutes?: number;
  asleepMinutes?: number;
  awakeMinutes?: number;
  remMinutes?: number;
  deepMinutes?: number;
  lightMinutes?: number;
  deviceName?: string;
  metadata?: Record<string, unknown>;
}

export type WorkoutKind =
  | 'strength'
  | 'running'
  | 'cycling'
  | 'walking'
  | 'hiit'
  | 'yoga'
  | 'rowing'
  | 'swimming'
  | 'other';

export interface WorkoutSample {
  sourceUuid: string;
  workoutType: WorkoutKind;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  totalCalories?: number;
  activeCalories?: number;
  distanceMeters?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  deviceName?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthUpdate {
  type: HealthDataType;
  changedAt: string;
}

/** Canonical unit per data type. Implementations must convert. */
export const HEALTH_UNITS: Record<HealthDataType, string> = {
  steps: 'count',
  heart_rate: 'bpm',
  resting_heart_rate: 'bpm',
  hrv: 'ms',
  active_calories: 'kcal',
  total_calories: 'kcal',
  sleep: 'minutes',
  workouts: 'session',
  weight: 'kg',
  body_fat: 'percent',
};

export interface HealthDataProvider {
  readonly id: HealthSource;

  isAvailable(): Promise<boolean>;
  getAuthStatus(types: HealthDataType[]): Promise<HealthAuthStatus>;
  requestPermissions(types: HealthDataType[]): Promise<PermissionResult>;

  readSteps(range: DateRange): Promise<HealthSample[]>;
  readHeartRate(range: DateRange): Promise<HealthSample[]>;
  readRestingHeartRate(range: DateRange): Promise<HealthSample[]>;
  readHRV(range: DateRange): Promise<HealthSample[]>;
  readActiveCalories(range: DateRange): Promise<HealthSample[]>;
  readTotalCalories(range: DateRange): Promise<HealthSample[]>;
  readSleepSessions(range: DateRange): Promise<SleepSample[]>;
  readWorkouts(range: DateRange): Promise<WorkoutSample[]>;
  readWeight(range: DateRange): Promise<HealthSample[]>;
  readBodyFat(range: DateRange): Promise<HealthSample[]>;

  /** Returns an unsubscribe function. No-op if platform doesn't support it. */
  subscribeToUpdates(cb: (update: HealthUpdate) => void): () => void;
}

export const ALL_HEALTH_TYPES: HealthDataType[] = [
  'steps',
  'heart_rate',
  'resting_heart_rate',
  'hrv',
  'active_calories',
  'total_calories',
  'sleep',
  'workouts',
  'weight',
  'body_fat',
];
