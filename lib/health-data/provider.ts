import { Platform } from 'react-native';
import { MockHealthDataProvider } from './MockHealthDataProvider';
import { HealthKitProvider } from './HealthKitProvider';
import { HealthConnectProvider } from './HealthConnectProvider';
import type { HealthDataProvider } from './types';

let cached: HealthDataProvider | null = null;

export function getHealthDataProvider(): HealthDataProvider {
  if (cached) return cached;
  if (Platform.OS === 'ios') cached = new HealthKitProvider();
  else if (Platform.OS === 'android') cached = new HealthConnectProvider();
  else cached = new MockHealthDataProvider();
  return cached;
}

/** Test seam: forces a specific provider (used by Jest setup). */
export function _setHealthDataProvider(p: HealthDataProvider | null) {
  cached = p;
}
