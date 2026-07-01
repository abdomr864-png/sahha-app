/** Resolves the right HealthService for the running platform (cached). */
import { Platform } from 'react-native';
import { HealthConnectService } from './HealthConnectService';
import { HealthKitService } from './HealthKitService';
import type { HealthService } from './service';

let cached: HealthService | null = null;
let resolved = false;

/**
 * Returns the platform HealthService, or `null` on platforms with no health hub
 * (web, or Expo Go without the native modules). Callers treat null as
 * "unavailable".
 */
export function getHealthService(): HealthService | null {
  if (resolved) return cached;
  resolved = true;
  if (Platform.OS === 'ios') cached = new HealthKitService();
  else if (Platform.OS === 'android') cached = new HealthConnectService();
  else cached = null;
  return cached;
}
