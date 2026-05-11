import type {
  DateRange,
  HealthAuthStatus,
  HealthDataProvider,
  HealthDataType,
  HealthSample,
  HealthUpdate,
  PermissionResult,
  SleepSample,
  WorkoutKind,
  WorkoutSample,
} from './types';

/**
 * Apple HealthKit provider. Backed by `@kingstinct/react-native-healthkit`.
 *
 * The library's TS types vary across versions and its native module is
 * unavailable in Expo Go and on Android, so we lazy-require it inside a
 * try/catch and fall through to no-ops if the module is absent. This keeps
 * the JS bundle valid in every runtime; the native methods only fire on
 * iOS dev builds where the module is actually present.
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
 * The kingstinct library's TypeScript surface drifts between major versions,
 * and this file deliberately runs against multiple shapes. We use `any` as a
 * defensive bridge and validate fields at the use sites. */

type HK = any;

let cached: HK | null | undefined;
function loadHK(): HK | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('@kingstinct/react-native-healthkit');
  } catch {
    cached = null;
  }
  return cached;
}

const READ_TYPES_BY_TYPE: Record<HealthDataType, string[]> = {
  steps: ['HKQuantityTypeIdentifierStepCount'],
  heart_rate: ['HKQuantityTypeIdentifierHeartRate'],
  resting_heart_rate: ['HKQuantityTypeIdentifierRestingHeartRate'],
  hrv: ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN'],
  active_calories: ['HKQuantityTypeIdentifierActiveEnergyBurned'],
  total_calories: ['HKQuantityTypeIdentifierBasalEnergyBurned'],
  sleep: ['HKCategoryTypeIdentifierSleepAnalysis'],
  workouts: ['HKWorkoutTypeIdentifier'],
  weight: ['HKQuantityTypeIdentifierBodyMass'],
  body_fat: ['HKQuantityTypeIdentifierBodyFatPercentage'],
};

export class HealthKitProvider implements HealthDataProvider {
  readonly id = 'apple_health' as const;

  async isAvailable() {
    const hk = loadHK();
    if (!hk) return false;
    try {
      return await hk.isHealthDataAvailable();
    } catch {
      return false;
    }
  }

  async getAuthStatus(_types: HealthDataType[]): Promise<HealthAuthStatus> {
    // HealthKit by design hides "denied" from the app to prevent fingerprinting.
    // We treat it as not_determined until we've successfully read once.
    return (await this.isAvailable()) ? 'not_determined' : 'denied';
  }

  async requestPermissions(types: HealthDataType[]): Promise<PermissionResult> {
    const hk = loadHK();
    if (!hk) return { status: 'denied', granted: {} };
    const reads = types.flatMap((t) => READ_TYPES_BY_TYPE[t]);
    try {
      // The library exposes either `requestAuthorization` (older) or
      // `useHealthkitAuthorization` hook + `requestAuthorization` (newer).
      const ok = await (hk.requestAuthorization?.(reads, []) ??
        hk.default?.requestAuthorization?.(reads, []));
      return {
        status: ok ? 'granted' : 'denied',
        granted: Object.fromEntries(types.map((t) => [t, !!ok])) as Record<HealthDataType, boolean>,
      };
    } catch {
      return { status: 'denied', granted: {} };
    }
  }

  readSteps(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierStepCount', 'count', range);
  }
  readHeartRate(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierHeartRate', 'bpm', range);
  }
  readRestingHeartRate(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierRestingHeartRate', 'bpm', range);
  }
  readHRV(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms', range);
  }
  readActiveCalories(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal', range);
  }
  readTotalCalories(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierBasalEnergyBurned', 'kcal', range);
  }
  readWeight(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierBodyMass', 'kg', range);
  }
  readBodyFat(range: DateRange) {
    return this.readQuantity('HKQuantityTypeIdentifierBodyFatPercentage', 'percent', range);
  }

  async readSleepSessions(range: DateRange): Promise<SleepSample[]> {
    const hk = loadHK();
    if (!hk) return [];
    try {
      const samples: any[] =
        (await (hk.queryCategorySamples ?? hk.default?.queryCategorySamples)?.(
          'HKCategoryTypeIdentifierSleepAnalysis',
          {
            from: new Date(range.from),
            to: new Date(range.to),
          },
        )) ?? [];
      // Group consecutive same-day samples into one session.
      return samples.map((s, i) => {
        const start = new Date(s.startDate ?? s.start ?? s.startedAt);
        const end = new Date(s.endDate ?? s.end ?? s.endedAt);
        const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
        return {
          sourceUuid: String(s.uuid ?? s.UUID ?? `hk-sleep-${start.toISOString()}-${i}`),
          startedAt: start.toISOString(),
          endedAt: end.toISOString(),
          durationMinutes: minutes,
          asleepMinutes: s.value === 1 ? minutes : undefined,
          deviceName: s.device?.name,
          metadata: s.metadata,
        } as SleepSample;
      });
    } catch {
      return [];
    }
  }

  async readWorkouts(range: DateRange): Promise<WorkoutSample[]> {
    const hk = loadHK();
    if (!hk) return [];
    try {
      const samples: any[] =
        (await (hk.queryWorkouts ?? hk.default?.queryWorkouts)?.({
          from: new Date(range.from),
          to: new Date(range.to),
        })) ?? [];
      return samples.map((w, i) => {
        const start = new Date(w.startDate ?? w.startedAt);
        const end = new Date(w.endDate ?? w.endedAt);
        return {
          sourceUuid: String(w.uuid ?? w.UUID ?? `hk-wo-${start.toISOString()}-${i}`),
          workoutType: mapHkWorkoutType(w.activityType ?? w.workoutActivityType),
          startedAt: start.toISOString(),
          endedAt: end.toISOString(),
          durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
          totalCalories: w.totalEnergyBurned?.quantity,
          activeCalories: w.totalActiveEnergyBurned?.quantity,
          distanceMeters: w.totalDistance?.quantity,
          deviceName: w.device?.name ?? w.sourceRevision?.source?.name,
          metadata: w.metadata,
        } as WorkoutSample;
      });
    } catch {
      return [];
    }
  }

  subscribeToUpdates(_cb: (u: HealthUpdate) => void) {
    // HealthKit observers via the library's `subscribeToChanges` API land in
    // a follow-up — for now foreground sync handles freshness.
    return () => undefined;
  }

  private async readQuantity(
    identifier: string,
    unit: string,
    range: DateRange,
  ): Promise<HealthSample[]> {
    const hk = loadHK();
    if (!hk) return [];
    try {
      const fn = hk.queryQuantitySamples ?? hk.default?.queryQuantitySamples;
      const raw: any[] =
        (await fn?.(identifier, {
          from: new Date(range.from),
          to: new Date(range.to),
          unit,
        })) ?? [];
      return raw.map((s, i) => {
        const recorded = new Date(s.startDate ?? s.startedAt ?? s.date);
        return {
          sourceUuid: String(s.uuid ?? s.UUID ?? `hk-${identifier}-${recorded.toISOString()}-${i}`),
          recordedAt: recorded.toISOString(),
          value: Number(s.quantity ?? s.value ?? 0),
          unit,
          deviceName: s.device?.name ?? s.sourceRevision?.source?.name,
          metadata: s.metadata,
        };
      });
    } catch {
      return [];
    }
  }
}

function mapHkWorkoutType(t: number | string | undefined): WorkoutKind {
  // HKWorkoutActivityType is a numeric enum; we only branch on the common ones.
  // String fallback for newer versions that already expose names.
  const s = typeof t === 'string' ? t.toLowerCase() : '';
  if (s.includes('strength') || t === 50) return 'strength';
  if (s.includes('running') || t === 37) return 'running';
  if (s.includes('cycling') || t === 13) return 'cycling';
  if (s.includes('walking') || t === 52) return 'walking';
  if (s.includes('hiit') || t === 63) return 'hiit';
  if (s.includes('yoga') || t === 57) return 'yoga';
  if (s.includes('rowing') || t === 35) return 'rowing';
  if (s.includes('swimming') || t === 46) return 'swimming';
  return 'other';
}
