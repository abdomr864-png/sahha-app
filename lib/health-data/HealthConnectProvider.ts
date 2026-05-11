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
 * Android Health Connect provider. Backed by `react-native-health-connect`.
 * Lazy-required so the bundle stays valid when the native module isn't
 * present (iOS, Expo Go, web).
 */

/* eslint-disable @typescript-eslint/no-explicit-any --
 * react-native-health-connect's TS surface varies between versions; we use
 * `any` as a defensive bridge and validate the fields we read at the call
 * site. */

type HC = any;

let cached: HC | null | undefined;
function loadHC(): HC | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('react-native-health-connect');
  } catch {
    cached = null;
  }
  return cached;
}

/** Pulls a named export off the lazy module, supporting both ESM-default and
 *  flat CJS shapes. Returns `null` if neither path resolves to a function. */
function fn<F extends (...args: any[]) => any>(hc: HC, name: string): F | null {
  const direct = hc?.[name];
  if (typeof direct === 'function') return direct as F;
  const fromDefault = hc?.default?.[name];
  if (typeof fromDefault === 'function') return fromDefault as F;
  return null;
}

const PERMISSIONS_BY_TYPE: Record<HealthDataType, string[]> = {
  steps: ['Steps'],
  heart_rate: ['HeartRate'],
  resting_heart_rate: ['RestingHeartRate'],
  hrv: ['HeartRateVariabilityRmssd'],
  active_calories: ['ActiveCaloriesBurned'],
  total_calories: ['TotalCaloriesBurned'],
  sleep: ['SleepSession'],
  workouts: ['ExerciseSession'],
  weight: ['Weight'],
  body_fat: ['BodyFat'],
};

export class HealthConnectProvider implements HealthDataProvider {
  readonly id = 'health_connect' as const;
  private initialized = false;

  private async ensureInit() {
    if (this.initialized) return true;
    const hc = loadHC();
    if (!hc) return false;
    try {
      const initialize = fn<() => Promise<unknown>>(hc, 'initialize');
      if (initialize) await initialize();
      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  async isAvailable() {
    const hc = loadHC();
    if (!hc) return false;
    try {
      const getSdkStatus = fn<() => Promise<number | string>>(hc, 'getSdkStatus');
      if (!getSdkStatus) return false;
      const status = await getSdkStatus();
      return status === 3 /* SDK_AVAILABLE */ || status === 'SDK_AVAILABLE';
    } catch {
      return false;
    }
  }

  async getAuthStatus(_types: HealthDataType[]): Promise<HealthAuthStatus> {
    return (await this.isAvailable()) ? 'not_determined' : 'denied';
  }

  async requestPermissions(types: HealthDataType[]): Promise<PermissionResult> {
    const hc = loadHC();
    if (!hc || !(await this.ensureInit())) {
      return { status: 'denied', granted: {} };
    }
    const permissions = types.flatMap((t) =>
      PERMISSIONS_BY_TYPE[t].map((recordType) => ({
        accessType: 'read' as const,
        recordType,
      })),
    );
    try {
      const requestPermission = fn<(p: unknown) => Promise<Array<{ recordType: string }>>>(
        hc,
        'requestPermission',
      );
      if (!requestPermission) return { status: 'denied', granted: {} };
      const granted = await requestPermission(permissions);
      const grantedSet = new Set(granted.map((g) => g.recordType));
      const result: Partial<Record<HealthDataType, boolean>> = {};
      for (const t of types) {
        result[t] = PERMISSIONS_BY_TYPE[t].every((rt) => grantedSet.has(rt));
      }
      return {
        status: granted.length > 0 ? 'granted' : 'denied',
        granted: result,
      };
    } catch {
      return { status: 'denied', granted: {} };
    }
  }

  readSteps(r: DateRange) {
    return this.readPoint('Steps', 'count', r, 'count');
  }
  readHeartRate(r: DateRange) {
    return this.readSeries('HeartRate', 'bpm', r);
  }
  readRestingHeartRate(r: DateRange) {
    return this.readPoint('RestingHeartRate', 'bpm', r, 'beatsPerMinute');
  }
  readHRV(r: DateRange) {
    return this.readPoint('HeartRateVariabilityRmssd', 'ms', r, 'heartRateVariabilityMillis');
  }
  readActiveCalories(r: DateRange) {
    return this.readPoint('ActiveCaloriesBurned', 'kcal', r, 'energy', 'inKilocalories');
  }
  readTotalCalories(r: DateRange) {
    return this.readPoint('TotalCaloriesBurned', 'kcal', r, 'energy', 'inKilocalories');
  }
  readWeight(r: DateRange) {
    return this.readPoint('Weight', 'kg', r, 'weight', 'inKilograms');
  }
  readBodyFat(r: DateRange) {
    return this.readPoint('BodyFat', 'percent', r, 'percentage');
  }

  async readSleepSessions(r: DateRange): Promise<SleepSample[]> {
    if (!(await this.ensureInit())) return [];
    try {
      const records = await this.readRecords('SleepSession', r);
      return (records ?? []).map((rec, i) => {
        const start = new Date(rec.startTime);
        const end = new Date(rec.endTime);
        const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
        const stages: any[] = rec.stages ?? [];
        const stageMinutes = (kind: string) =>
          stages
            .filter((s) => s.stage === kind)
            .reduce(
              (acc, s) =>
                acc +
                Math.round(
                  (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60_000,
                ),
              0,
            ) || undefined;
        return {
          sourceUuid: String(rec.metadata?.id ?? rec.id ?? `hc-sleep-${start.toISOString()}-${i}`),
          startedAt: start.toISOString(),
          endedAt: end.toISOString(),
          durationMinutes: minutes,
          inBedMinutes: stageMinutes('IN_BED'),
          asleepMinutes: stageMinutes('SLEEPING'),
          awakeMinutes: stageMinutes('AWAKE'),
          remMinutes: stageMinutes('REM'),
          deepMinutes: stageMinutes('DEEP'),
          lightMinutes: stageMinutes('LIGHT'),
          deviceName: rec.metadata?.device?.model,
        } as SleepSample;
      });
    } catch {
      return [];
    }
  }

  async readWorkouts(r: DateRange): Promise<WorkoutSample[]> {
    if (!(await this.ensureInit())) return [];
    try {
      const records = await this.readRecords('ExerciseSession', r);
      return (records ?? []).map((rec, i) => {
        const start = new Date(rec.startTime);
        const end = new Date(rec.endTime);
        return {
          sourceUuid: String(rec.metadata?.id ?? rec.id ?? `hc-wo-${start.toISOString()}-${i}`),
          workoutType: mapHcExerciseType(rec.exerciseType),
          startedAt: start.toISOString(),
          endedAt: end.toISOString(),
          durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
          deviceName: rec.metadata?.device?.model,
          metadata: { title: rec.title, notes: rec.notes },
        } as WorkoutSample;
      });
    } catch {
      return [];
    }
  }

  subscribeToUpdates(_cb: (u: HealthUpdate) => void) {
    return () => undefined;
  }

  private async readRecords(recordType: string, r: DateRange): Promise<any[]> {
    const hc = loadHC();
    if (!hc) return [];
    const reader = fn<(t: string, o: unknown) => Promise<{ records?: unknown[] }>>(
      hc,
      'readRecords',
    );
    if (!reader) return [];
    const result = await reader(recordType, {
      timeRangeFilter: {
        operator: 'between',
        startTime: r.from,
        endTime: r.to,
      },
    });
    return (result.records ?? []) as any[];
  }

  private async readPoint(
    recordType: string,
    unit: string,
    r: DateRange,
    valueField = 'count',
    unitField?: string,
  ): Promise<HealthSample[]> {
    if (!(await this.ensureInit())) return [];
    try {
      const records = await this.readRecords(recordType, r);
      return records.map((rec, i) => {
        const at = new Date(rec.time ?? rec.startTime ?? rec.endTime);
        const node = rec[valueField];
        const value =
          typeof node === 'number'
            ? node
            : unitField
              ? Number(node?.[unitField] ?? 0)
              : Number(node?.value ?? node ?? 0);
        return {
          sourceUuid: String(
            rec.metadata?.id ?? rec.id ?? `hc-${recordType}-${at.toISOString()}-${i}`,
          ),
          recordedAt: at.toISOString(),
          value,
          unit,
          deviceName: rec.metadata?.device?.model,
        };
      });
    } catch {
      return [];
    }
  }

  private async readSeries(
    recordType: string,
    unit: string,
    r: DateRange,
  ): Promise<HealthSample[]> {
    if (!(await this.ensureInit())) return [];
    try {
      const records = await this.readRecords(recordType, r);
      const out: HealthSample[] = [];
      for (const rec of records) {
        const series: any[] = rec.samples ?? [];
        for (const s of series) {
          const at = new Date(s.time);
          out.push({
            sourceUuid: `${rec.metadata?.id ?? recordType}-${at.toISOString()}`,
            recordedAt: at.toISOString(),
            value: Number(s.beatsPerMinute ?? s.value ?? 0),
            unit,
            deviceName: rec.metadata?.device?.model,
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
}

function mapHcExerciseType(t: number | string | undefined): WorkoutKind {
  // Health Connect uses numeric ExerciseType enum (~80 values). We branch on
  // the common ones; the rest fall through to 'other'.
  const s = typeof t === 'string' ? t.toLowerCase() : '';
  if (s.includes('strength') || t === 56 /* STRENGTH_TRAINING */) return 'strength';
  if (s.includes('running') || t === 56 /* RUNNING */) return 'running';
  if (s.includes('cycling') || t === 8 /* BIKING */) return 'cycling';
  if (s.includes('walking') || t === 79 /* WALKING */) return 'walking';
  if (s.includes('hiit') || t === 24 /* HIGH_INTENSITY_INTERVAL_TRAINING */) return 'hiit';
  if (s.includes('yoga') || t === 83 /* YOGA */) return 'yoga';
  if (s.includes('rowing') || t === 53 /* ROWING */) return 'rowing';
  if (s.includes('swimming') || t === 74 /* SWIMMING */) return 'swimming';
  return 'other';
}
