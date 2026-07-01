/**
 * Normalizes platform records (from @lib/health-data) into `health_metrics`
 * rows. Pure + side-effect-free so it can be unit-tested without a device.
 *
 * Two non-obvious concerns handled here:
 *  1. HRV variant — HealthKit gives SDNN, Health Connect gives RMSSD. We tag
 *     the metric_type accordingly (`hrv_sdnn` / `hrv_rmssd`); they are NEVER
 *     merged.
 *  2. Dedup — every row gets a non-null, stable `external_id`. The provider's
 *     `sourceUuid` is preferred; when a source omits it we synthesize one from
 *     (metric_type, start_time) so a re-sync of the same instant upserts in
 *     place rather than duplicating (the DB unique key treats NULLs as
 *     distinct, so a NULL external_id would defeat dedup).
 */
import type { HealthSample, HealthSource, SleepSample, WorkoutSample } from '@lib/health-data';
import { METRIC_UNITS, type HealthMetricRow, type MetricType, type SourcePlatform } from './types';

export function platformFromSource(source: HealthSource): SourcePlatform {
  // mock falls back to the host platform at the call site; here we only ever
  // see real providers, and apple→ios / health_connect→android.
  return source === 'apple_health' ? 'ios' : 'android';
}

/** HRV metric variant for the platform. iOS = SDNN, Android = RMSSD. */
export function hrvMetricFor(platform: SourcePlatform): 'hrv_sdnn' | 'hrv_rmssd' {
  return platform === 'ios' ? 'hrv_sdnn' : 'hrv_rmssd';
}

function externalId(metric: MetricType, sourceUuid: string | undefined, startTime: string): string {
  return sourceUuid && sourceUuid.length > 0 ? sourceUuid : `${metric}:${startTime}`;
}

interface MapCtx {
  userId: string;
  platform: SourcePlatform;
  /** Fallback hub name (e.g. "Apple Health") when a sample has no device. */
  source: string | null;
}

function row(
  ctx: MapCtx,
  metric: MetricType,
  value: number,
  startTime: string,
  endTime: string | null,
  sourceUuid: string | undefined,
  device: string | undefined,
  metadata: Record<string, unknown> | null,
): HealthMetricRow {
  return {
    user_id: ctx.userId,
    metric_type: metric,
    value,
    unit: METRIC_UNITS[metric],
    start_time: startTime,
    end_time: endTime,
    source: device ?? ctx.source, // prefer the originating device ("Apple Watch")
    source_platform: ctx.platform,
    external_id: externalId(metric, sourceUuid, startTime),
    metadata,
  };
}

export function mapScalar(
  ctx: MapCtx,
  metric: MetricType,
  samples: HealthSample[],
): HealthMetricRow[] {
  return samples.map((s) =>
    row(ctx, metric, s.value, s.recordedAt, null, s.sourceUuid, s.deviceName, s.metadata ?? null),
  );
}

/** HRV samples → the platform-correct variant (`hrv_sdnn` | `hrv_rmssd`). */
export function mapHrv(ctx: MapCtx, samples: HealthSample[]): HealthMetricRow[] {
  const metric = hrvMetricFor(ctx.platform);
  return samples.map((s) =>
    row(ctx, metric, s.value, s.recordedAt, null, s.sourceUuid, s.deviceName, {
      ...(s.metadata ?? {}),
      hrv_variant: metric === 'hrv_sdnn' ? 'SDNN' : 'RMSSD',
    }),
  );
}

/** Sleep sessions → one `sleep` row (asleep minutes, falling back to duration). */
export function mapSleep(ctx: MapCtx, sessions: SleepSample[]): HealthMetricRow[] {
  return sessions.map((s) =>
    row(
      ctx,
      'sleep',
      s.asleepMinutes ?? s.durationMinutes,
      s.startedAt,
      s.endedAt,
      s.sourceUuid,
      s.deviceName,
      {
        in_bed_minutes: s.inBedMinutes ?? null,
        rem_minutes: s.remMinutes ?? null,
        deep_minutes: s.deepMinutes ?? null,
        light_minutes: s.lightMinutes ?? null,
      },
    ),
  );
}

/**
 * Workout sessions fan out into:
 *  - a `workout` row (value 1 — counted per day in the view),
 *  - an `active_minutes` row (session duration),
 *  - a `distance` row when the session recorded distance.
 * All three share the workout's sourceUuid suffixed by metric so they keep
 * distinct external_ids.
 */
export function mapWorkouts(ctx: MapCtx, workouts: WorkoutSample[]): HealthMetricRow[] {
  const rows: HealthMetricRow[] = [];
  for (const w of workouts) {
    const baseMeta = { workout_type: w.workoutType, active_calories: w.activeCalories ?? null };
    rows.push(
      row(
        ctx,
        'workout',
        1,
        w.startedAt,
        w.endedAt,
        suffix(w.sourceUuid, 'workout'),
        w.deviceName,
        baseMeta,
      ),
    );
    rows.push(
      row(
        ctx,
        'active_minutes',
        w.durationMinutes,
        w.startedAt,
        w.endedAt,
        suffix(w.sourceUuid, 'active'),
        w.deviceName,
        baseMeta,
      ),
    );
    if (typeof w.distanceMeters === 'number' && w.distanceMeters > 0) {
      rows.push(
        row(
          ctx,
          'distance',
          w.distanceMeters,
          w.startedAt,
          w.endedAt,
          suffix(w.sourceUuid, 'dist'),
          w.deviceName,
          baseMeta,
        ),
      );
    }
  }
  return rows;
}

function suffix(sourceUuid: string | undefined, tag: string): string | undefined {
  return sourceUuid ? `${sourceUuid}:${tag}` : undefined;
}

/**
 * De-duplicates rows on (metric_type, external_id), keeping the last seen — the
 * same idempotency the DB unique key enforces, applied in-memory before upsert.
 */
export function dedupeRows(rows: HealthMetricRow[]): HealthMetricRow[] {
  const byKey = new Map<string, HealthMetricRow>();
  for (const r of rows) {
    byKey.set(`${r.metric_type}|${r.external_id}`, r);
  }
  return Array.from(byKey.values());
}
