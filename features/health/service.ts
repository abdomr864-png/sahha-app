/**
 * HealthService — the app-facing surface over device health data. Platform
 * specifics stay isolated: this base class delegates all device I/O to a
 * `HealthDataProvider` (from @lib/health-data, which wraps HealthKit /
 * Health Connect), and the iOS/Android subclasses only set the platform tag,
 * the hub label, and availability semantics.
 *
 * Incremental reads (`readChanges`) currently use a **time cursor** persisted in
 * `health_sync_state.last_synced_at`: read `[cursor − overlap, now]`, dedup by
 * external_id (idempotent). The `sync_token` column + this method are the slot
 * where a true HKAnchoredObjectQuery anchor / Health Connect `getChanges` token
 * would go — that requires extending the provider with anchor/changes APIs and
 * can only be verified on a device build, so it's intentionally deferred.
 */
import type {
  DateRange as ProviderRange,
  HealthDataProvider,
  HealthDataType,
} from '@lib/health-data';
import { mapHrv, mapScalar, mapSleep, mapWorkouts } from './mapper';
import { runSyncAll } from './sync';
import {
  type DateRange,
  type HealthAvailability,
  type HealthMetricRow,
  type HealthPermissionStatus,
  type HealthSyncResult,
  type SourcePlatform,
  HealthError,
  PROVIDER_TYPES_FOR_SYNC,
} from './types';

/** How far back to read on the first sync (no cursor yet). */
const BACKFILL_DAYS = 30;
/** Re-read overlap on incremental syncs to catch late-arriving samples. */
const OVERLAP_MS = 6 * 60 * 60 * 1000;

export interface HealthService {
  readonly platform: SourcePlatform;
  /** Hub label stored as the fallback `source` (e.g. "Apple Health"). */
  readonly hubName: string;

  isAvailable(): Promise<HealthAvailability>;
  requestPermissions(): Promise<HealthPermissionStatus>;
  getPermissionStatus(): Promise<HealthPermissionStatus>;

  /** Read + normalize one provider data type over an explicit range. */
  readMetric(type: HealthDataType, range: DateRange): Promise<HealthMetricRow[]>;

  /**
   * Incremental read for one provider data type since `token` (an ISO cursor).
   * Returns the normalized rows and the next cursor to persist.
   */
  readChanges(
    type: HealthDataType,
    token: string | null,
    userId: string,
  ): Promise<{ rows: HealthMetricRow[]; token: string }>;

  /** Pull every supported type since its cursor and upsert into Supabase. */
  syncAll(userId: string): Promise<HealthSyncResult>;
}

export abstract class BaseHealthService implements HealthService {
  abstract readonly platform: SourcePlatform;
  abstract readonly hubName: string;

  protected constructor(protected readonly provider: HealthDataProvider) {}

  abstract isAvailable(): Promise<HealthAvailability>;

  async requestPermissions(): Promise<HealthPermissionStatus> {
    const res = await this.provider.requestPermissions(PROVIDER_TYPES_FOR_SYNC);
    const grants = Object.values(res.granted);
    const anyGranted = grants.some(Boolean);
    const allGranted = grants.length === PROVIDER_TYPES_FOR_SYNC.length && grants.every(Boolean);
    if (res.status === 'granted' || allGranted) return 'granted';
    if (anyGranted) return 'partial';
    if (res.status === 'not_determined') return 'not_determined';
    return 'denied';
  }

  async getPermissionStatus(): Promise<HealthPermissionStatus> {
    const status = await this.provider.getAuthStatus(PROVIDER_TYPES_FOR_SYNC);
    return status; // 'not_determined' | 'denied' | 'granted'
  }

  async readMetric(type: HealthDataType, range: DateRange): Promise<HealthMetricRow[]> {
    // userId is filled by the mapper ctx at the caller; readMetric is primarily
    // used by syncAll which passes its own userId. Here we read with a
    // placeholder userId and let syncAll re-stamp — but to keep the surface
    // honest we require it via readChanges. readMetric returns device-shaped
    // rows with an empty user_id for ad-hoc/testing reads.
    return this.readAndMap(type, range, '');
  }

  async readChanges(
    type: HealthDataType,
    token: string | null,
    userId: string,
  ): Promise<{ rows: HealthMetricRow[]; token: string }> {
    const now = Date.now();
    const from = token
      ? new Date(new Date(token).getTime() - OVERLAP_MS)
      : new Date(now - BACKFILL_DAYS * 86_400_000);
    const range: DateRange = { from: from.toISOString(), to: new Date(now).toISOString() };
    const rows = await this.readAndMap(type, range, userId);
    return { rows, token: range.to };
  }

  syncAll(userId: string): Promise<HealthSyncResult> {
    return runSyncAll(this, userId);
  }

  /** Dispatch a provider read for `type` and normalize via the mapper. */
  protected async readAndMap(
    type: HealthDataType,
    range: DateRange,
    userId: string,
  ): Promise<HealthMetricRow[]> {
    const ctx = { userId, platform: this.platform, source: this.hubName };
    const pr: ProviderRange = { from: range.from, to: range.to };
    try {
      switch (type) {
        case 'steps':
          return mapScalar(ctx, 'steps', await this.provider.readSteps(pr));
        case 'resting_heart_rate':
          return mapScalar(ctx, 'resting_hr', await this.provider.readRestingHeartRate(pr));
        case 'hrv':
          return mapHrv(ctx, await this.provider.readHRV(pr));
        case 'weight':
          return mapScalar(ctx, 'weight', await this.provider.readWeight(pr));
        case 'sleep':
          return mapSleep(ctx, await this.provider.readSleepSessions(pr));
        case 'workouts':
          return mapWorkouts(ctx, await this.provider.readWorkouts(pr));
        default:
          // Types not surfaced on the dashboard (heart_rate, calories, body_fat).
          return [];
      }
    } catch (e) {
      throw new HealthError('read_failed', `${type}: ${(e as Error)?.message ?? 'unknown'}`);
    }
  }
}
