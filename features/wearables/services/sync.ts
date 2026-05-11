import { supabase } from '@lib/supabase/client';
import {
  ALL_HEALTH_TYPES,
  getHealthDataProvider,
  type DateRange,
  type HealthDataProvider,
  type HealthDataType,
  type HealthSample,
  type HealthSource,
  type SleepSample,
  type WorkoutSample,
} from '@lib/health-data';

export interface SyncResult {
  /** Per-type insert counts (samples, sleep sessions, workouts). */
  counts: Partial<Record<HealthDataType, number>>;
  /** Per-type errors — sync continues on partial failure. */
  errors: Partial<Record<HealthDataType, string>>;
  syncedAt: string;
}

const METRIC_NAME: Record<HealthDataType, string> = {
  steps: 'steps',
  heart_rate: 'heart_rate',
  resting_heart_rate: 'resting_heart_rate',
  hrv: 'hrv',
  active_calories: 'active_calories',
  total_calories: 'total_calories',
  sleep: 'sleep',
  workouts: 'workouts',
  weight: 'weight',
  body_fat: 'body_fat',
};

/**
 * Pulls every selected type for `range`, normalizes, and upserts into
 * Supabase. Idempotent — relies on the unique indexes from migration 0021.
 */
export async function syncRange(
  userId: string,
  range: DateRange,
  types: HealthDataType[] = ALL_HEALTH_TYPES,
  provider: HealthDataProvider = getHealthDataProvider(),
): Promise<SyncResult> {
  const source = mapSource(provider.id);
  const counts: SyncResult['counts'] = {};
  const errors: SyncResult['errors'] = {};

  for (const type of types) {
    try {
      counts[type] = await syncOne(userId, source, type, range, provider);
    } catch (e) {
      errors[type] = (e as Error)?.message ?? 'unknown';
    }
  }

  const syncedAt = new Date().toISOString();
  await supabase
    .from('health_sync_settings')
    .upsert(
      { user_id: userId, last_synced_at: syncedAt, updated_at: syncedAt },
      { onConflict: 'user_id' },
    );

  return { counts, errors, syncedAt };
}

async function syncOne(
  userId: string,
  source: HealthSource,
  type: HealthDataType,
  range: DateRange,
  p: HealthDataProvider,
): Promise<number> {
  switch (type) {
    case 'steps':
      return upsertSamples(userId, source, type, await p.readSteps(range));
    case 'heart_rate':
      return upsertSamples(userId, source, type, await p.readHeartRate(range));
    case 'resting_heart_rate':
      return upsertSamples(userId, source, type, await p.readRestingHeartRate(range));
    case 'hrv':
      return upsertSamples(userId, source, type, await p.readHRV(range));
    case 'active_calories':
      return upsertSamples(userId, source, type, await p.readActiveCalories(range));
    case 'total_calories':
      return upsertSamples(userId, source, type, await p.readTotalCalories(range));
    case 'weight':
      return upsertSamples(userId, source, type, await p.readWeight(range));
    case 'body_fat':
      return upsertSamples(userId, source, type, await p.readBodyFat(range));
    case 'sleep':
      return upsertSleep(userId, source, await p.readSleepSessions(range));
    case 'workouts':
      return upsertWorkouts(userId, source, await p.readWorkouts(range));
  }
}

async function upsertSamples(
  userId: string,
  source: HealthSource,
  type: HealthDataType,
  samples: HealthSample[],
) {
  if (samples.length === 0) return 0;
  const rows = samples.map((s) => ({
    user_id: userId,
    source,
    metric_type: METRIC_NAME[type],
    value: s.value,
    unit: s.unit,
    recorded_at: s.recordedAt,
    recorded_at_local: s.recordedAtLocal,
    source_uuid: s.sourceUuid,
    device_name: s.deviceName,
    metadata: s.metadata ?? null,
  }));
  // Chunk to avoid Postgrest payload limits.
  let inserted = 0;
  for (const batch of chunk(rows, 500)) {
    const { error, count } = await supabase.from('wearable_metrics').upsert(batch, {
      onConflict: 'user_id,source,metric_type,recorded_at,source_uuid',
      count: 'exact',
      ignoreDuplicates: false,
    });
    if (error) throw error;
    inserted += count ?? batch.length;
  }
  return inserted;
}

async function upsertSleep(userId: string, source: HealthSource, samples: SleepSample[]) {
  if (samples.length === 0) return 0;
  const rows = samples.map((s) => ({
    user_id: userId,
    source,
    source_uuid: s.sourceUuid,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    duration_minutes: s.durationMinutes,
    in_bed_minutes: s.inBedMinutes,
    asleep_minutes: s.asleepMinutes,
    awake_minutes: s.awakeMinutes,
    rem_minutes: s.remMinutes,
    deep_minutes: s.deepMinutes,
    light_minutes: s.lightMinutes,
    device_name: s.deviceName,
    metadata: s.metadata ?? null,
  }));
  let n = 0;
  for (const batch of chunk(rows, 200)) {
    const { error, count } = await supabase.from('sleep_sessions_synced').upsert(batch, {
      onConflict: 'user_id,source,started_at,source_uuid',
      count: 'exact',
      ignoreDuplicates: false,
    });
    if (error) throw error;
    n += count ?? batch.length;
  }
  return n;
}

async function upsertWorkouts(userId: string, source: HealthSource, samples: WorkoutSample[]) {
  if (samples.length === 0) return 0;
  const rows = samples.map((s) => ({
    user_id: userId,
    source,
    source_uuid: s.sourceUuid,
    workout_type: s.workoutType,
    started_at: s.startedAt,
    ended_at: s.endedAt,
    duration_minutes: s.durationMinutes,
    total_calories: s.totalCalories,
    active_calories: s.activeCalories,
    distance_meters: s.distanceMeters,
    avg_heart_rate: s.avgHeartRate,
    max_heart_rate: s.maxHeartRate,
    device_name: s.deviceName,
    metadata: s.metadata ?? null,
  }));
  let n = 0;
  for (const batch of chunk(rows, 200)) {
    const { error, count } = await supabase.from('workouts_synced').upsert(batch, {
      onConflict: 'user_id,source,started_at,source_uuid',
      count: 'exact',
      ignoreDuplicates: false,
    });
    if (error) throw error;
    n += count ?? batch.length;
  }
  return n;
}

function mapSource(id: HealthDataProvider['id']): HealthSource {
  if (id === 'apple_health' || id === 'health_connect' || id === 'mock') return id;
  return 'manual';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function rangeFromNow(days: number): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}
