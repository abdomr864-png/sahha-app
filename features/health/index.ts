/**
 * Sahha health-data aggregation layer (supersedes features/wearables).
 * Reads Apple HealthKit / Google Health Connect via @lib/health-data, mirrors
 * normalized samples into Supabase (`health_metrics`), and powers the dashboard
 * from the `health_daily` view.
 */
export type {
  MetricType,
  DailyMetric,
  HealthMetricRow,
  HealthAvailability,
  HealthPermissionStatus,
  HealthSyncResult,
  SourcePlatform,
} from './types';
export { HealthError, HEALTH_PRIVACY_POLICY_URL, ALL_METRIC_TYPES } from './types';

export type { HealthService } from './service';
export { getHealthService } from './resolve';

export { useHealthStore } from './store';
export { useHealthMetrics, useTodayHealthMetrics } from './hooks/useHealthMetrics';
export type { TodayHealthMetrics } from './hooks/useHealthMetrics';

// Recovery / readiness system.
export { useRecovery } from './hooks/useRecovery';
export type { RecoveryResult } from './hooks/useRecovery';
export { useRecoveryBaseline, composeBaselines } from './hooks/useRecoveryBaseline';
export { RecoveryPage } from './components/RecoveryPage';
export { RECOVERY_CONFIG } from './recovery';
export type {
  RecoveryBand,
  RecoveryBaselines,
  RecoveryFactor,
  RecoveryInputs,
  RecoveryScore,
  AcwrResult,
  DeloadRecommendation,
  HrvVariant,
} from './recovery';

export { HealthPermissionFlow } from './components/HealthPermissionFlow';

export {
  registerHealthBackgroundSync,
  unregisterHealthBackgroundSync,
  HEALTH_BACKGROUND_TASK,
} from './background';
