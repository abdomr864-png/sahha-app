/**
 * Feature-flag system — typed local defaults + optional remote kill-switch.
 * Gate each Pro cluster's entry point on `useFeatureFlag('<cluster>')`.
 */
export { FEATURE_FLAGS, FEATURE_FLAG_KEYS } from './config';
export type { FeatureFlagKey } from './config';
export { useFeatureFlag, useRemoteFlags } from './hooks/useFeatureFlag';
