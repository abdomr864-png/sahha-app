import type {
  DateRange,
  HealthAuthStatus,
  HealthDataProvider,
  HealthDataType,
  HealthSample,
  HealthUpdate,
  PermissionResult,
  SleepSample,
  WorkoutSample,
} from './types';

/**
 * Deterministic in-memory provider used in dev, tests, and on platforms
 * where neither HealthKit nor Health Connect are available (web, Expo Go).
 * Returns plausible synthetic data keyed off the date.
 */
export class MockHealthDataProvider implements HealthDataProvider {
  readonly id = 'mock' as const;
  private status: HealthAuthStatus = 'not_determined';

  async isAvailable() {
    return true;
  }
  async getAuthStatus() {
    return this.status;
  }
  async requestPermissions(types: HealthDataType[]): Promise<PermissionResult> {
    this.status = 'granted';
    return {
      status: 'granted',
      granted: Object.fromEntries(types.map((t) => [t, true])) as Record<HealthDataType, boolean>,
    };
  }

  async readSteps(r: DateRange) {
    return this.daily(r, 'steps', (u) => Math.round(4000 + u * 8000), 'count');
  }
  async readHeartRate(r: DateRange) {
    return this.daily(r, 'hr', (u) => Math.round(70 + u * 30), 'bpm');
  }
  async readRestingHeartRate(r: DateRange) {
    return this.daily(r, 'rhr', (u) => Math.round(55 + u * 15), 'bpm');
  }
  async readHRV(r: DateRange) {
    return this.daily(r, 'hrv', (u) => Math.round(40 + u * 30), 'ms');
  }
  async readActiveCalories(r: DateRange) {
    return this.daily(r, 'akcal', (u) => Math.round(150 + u * 400), 'kcal');
  }
  async readTotalCalories(r: DateRange) {
    return this.daily(r, 'tkcal', (u) => Math.round(1800 + u * 800), 'kcal');
  }
  async readWeight(r: DateRange) {
    return this.daily(r, 'wt', (u) => Math.round((70 + u * 5) * 10) / 10, 'kg');
  }
  async readBodyFat(r: DateRange) {
    return this.daily(r, 'bf', (u) => Math.round((18 + u * 8) * 10) / 10, 'percent');
  }

  async readSleepSessions(r: DateRange): Promise<SleepSample[]> {
    if (this.status !== 'granted') return [];
    return enumerateDays(r).map((day, i) => {
      const u = pseudo(`sleep:${day}`);
      const start = new Date(`${day}T22:30:00Z`);
      const minutes = Math.round(360 + u * 180);
      const end = new Date(start.getTime() + minutes * 60_000);
      return {
        sourceUuid: `mock-sleep-${day}-${i}`,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        durationMinutes: minutes,
        asleepMinutes: minutes - 30,
        awakeMinutes: 30,
        deepMinutes: Math.round(minutes * 0.2),
        remMinutes: Math.round(minutes * 0.25),
        lightMinutes: Math.round(minutes * 0.55),
        deviceName: 'Mock Watch',
      };
    });
  }

  async readWorkouts(r: DateRange): Promise<WorkoutSample[]> {
    if (this.status !== 'granted') return [];
    return enumerateDays(r)
      .filter((_, i) => i % 2 === 0)
      .map((day, i) => {
        const start = new Date(`${day}T17:00:00Z`);
        const minutes = 45;
        const end = new Date(start.getTime() + minutes * 60_000);
        return {
          sourceUuid: `mock-wo-${day}-${i}`,
          workoutType: 'strength' as const,
          startedAt: start.toISOString(),
          endedAt: end.toISOString(),
          durationMinutes: minutes,
          totalCalories: 320,
          activeCalories: 280,
          avgHeartRate: 128,
          maxHeartRate: 162,
          deviceName: 'Mock Watch',
        };
      });
  }

  subscribeToUpdates(_cb: (u: HealthUpdate) => void) {
    return () => undefined;
  }

  private daily(
    range: DateRange,
    saltSeed: string,
    fn: (u: number) => number,
    unit: string,
  ): HealthSample[] {
    if (this.status !== 'granted') return [];
    return enumerateDays(range).map((day) => {
      const u = pseudo(`${saltSeed}:${day}`);
      return {
        sourceUuid: `mock-${saltSeed}-${day}`,
        recordedAt: `${day}T12:00:00.000Z`,
        recordedAtLocal: `${day}T12:00:00`,
        value: fn(u),
        unit,
        deviceName: 'Mock',
      };
    });
  }
}

function enumerateDays(r: DateRange): string[] {
  const out: string[] = [];
  const s = new Date(r.from);
  const e = new Date(r.to);
  for (let d = new Date(s); d < e; d = new Date(d.getTime() + 86_400_000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function pseudo(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((h >>> 0) / 0xffffffff) % 1;
}
