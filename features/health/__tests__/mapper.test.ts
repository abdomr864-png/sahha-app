import type { HealthSample, SleepSample, WorkoutSample } from '@lib/health-data';
import {
  dedupeRows,
  hrvMetricFor,
  mapHrv,
  mapScalar,
  mapSleep,
  mapWorkouts,
  platformFromSource,
} from '../mapper';

const ctxIOS = { userId: 'u1', platform: 'ios' as const, source: 'Apple Health' };
const ctxAndroid = { userId: 'u1', platform: 'android' as const, source: 'Health Connect' };

const sample = (over: Partial<HealthSample> = {}): HealthSample => ({
  sourceUuid: 'abc',
  recordedAt: '2026-06-01T08:00:00.000Z',
  value: 1234,
  unit: 'count',
  deviceName: 'Apple Watch',
  ...over,
});

describe('platformFromSource', () => {
  it('maps provider ids to platforms', () => {
    expect(platformFromSource('apple_health')).toBe('ios');
    expect(platformFromSource('health_connect')).toBe('android');
  });
});

describe('mapScalar', () => {
  it('normalizes a steps sample with device as source and stable external_id', () => {
    const row = mapScalar(ctxIOS, 'steps', [sample({ value: 5000 })])[0]!;
    expect(row).toMatchObject({
      user_id: 'u1',
      metric_type: 'steps',
      value: 5000,
      unit: 'count',
      source: 'Apple Watch',
      source_platform: 'ios',
      external_id: 'abc',
    });
  });

  it('synthesizes a stable external_id when the source omits one', () => {
    const row = mapScalar(ctxIOS, 'weight', [
      sample({ sourceUuid: '', value: 80, unit: 'kg', recordedAt: '2026-06-01T07:00:00.000Z' }),
    ])[0]!;
    expect(row.external_id).toBe('weight:2026-06-01T07:00:00.000Z');
  });
});

describe('mapHrv — SDNN vs RMSSD split', () => {
  it('iOS HRV becomes hrv_sdnn and tags the variant', () => {
    expect(hrvMetricFor('ios')).toBe('hrv_sdnn');
    const row = mapHrv(ctxIOS, [sample({ value: 65, unit: 'ms' })])[0]!;
    expect(row.metric_type).toBe('hrv_sdnn');
    expect(row.unit).toBe('ms');
    expect(row.metadata).toMatchObject({ hrv_variant: 'SDNN' });
  });

  it('Android HRV becomes hrv_rmssd and tags the variant', () => {
    expect(hrvMetricFor('android')).toBe('hrv_rmssd');
    const row = mapHrv(ctxAndroid, [sample({ value: 42, unit: 'ms' })])[0]!;
    expect(row.metric_type).toBe('hrv_rmssd');
    expect(row.metadata).toMatchObject({ hrv_variant: 'RMSSD' });
  });
});

describe('mapSleep', () => {
  it('prefers asleep minutes and falls back to duration', () => {
    const base: SleepSample = {
      sourceUuid: 's1',
      startedAt: '2026-06-01T23:00:00.000Z',
      endedAt: '2026-06-02T07:00:00.000Z',
      durationMinutes: 480,
      asleepMinutes: 430,
    };
    expect(mapSleep(ctxIOS, [base])[0]!.value).toBe(430);
    expect(mapSleep(ctxIOS, [{ ...base, asleepMinutes: undefined }])[0]!.value).toBe(480);
  });
});

describe('mapWorkouts', () => {
  const workout: WorkoutSample = {
    sourceUuid: 'w1',
    workoutType: 'running',
    startedAt: '2026-06-01T06:00:00.000Z',
    endedAt: '2026-06-01T06:45:00.000Z',
    durationMinutes: 45,
    distanceMeters: 8000,
  };

  it('fans a workout into workout + active_minutes + distance with distinct external_ids', () => {
    const rows = mapWorkouts(ctxIOS, [workout]);
    const byType = Object.fromEntries(rows.map((r) => [r.metric_type, r]));
    expect(byType.workout!.value).toBe(1);
    expect(byType.active_minutes!.value).toBe(45);
    expect(byType.distance!.value).toBe(8000);
    expect(new Set(rows.map((r) => r.external_id)).size).toBe(3);
  });

  it('omits distance when the session has none', () => {
    const rows = mapWorkouts(ctxIOS, [{ ...workout, distanceMeters: undefined }]);
    expect(rows.some((r) => r.metric_type === 'distance')).toBe(false);
  });
});

describe('dedupeRows', () => {
  it('collapses duplicate (metric_type, external_id), keeping the last seen', () => {
    const a = mapScalar(ctxIOS, 'steps', [sample({ value: 100 })]);
    const b = mapScalar(ctxIOS, 'steps', [sample({ value: 250 })]); // same external_id 'abc'
    const deduped = dedupeRows([...a, ...b]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]!.value).toBe(250);
  });

  it('keeps rows with different external_ids', () => {
    const rows = [
      ...mapScalar(ctxIOS, 'steps', [sample({ sourceUuid: 'x', value: 1 })]),
      ...mapScalar(ctxIOS, 'steps', [sample({ sourceUuid: 'y', value: 2 })]),
    ];
    expect(dedupeRows(rows)).toHaveLength(2);
  });
});
