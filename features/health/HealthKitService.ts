/** iOS HealthService — binds the HealthKit provider. */
import { HealthKitProvider } from '@lib/health-data';
import { BaseHealthService } from './service';
import type { HealthAvailability, SourcePlatform } from './types';

export class HealthKitService extends BaseHealthService {
  readonly platform: SourcePlatform = 'ios';
  readonly hubName = 'Apple Health';

  constructor() {
    super(new HealthKitProvider());
  }

  async isAvailable(): Promise<HealthAvailability> {
    // HealthKit ships on every iPhone; absence means the simulator or an
    // iPad without HealthKit — treat as plain "unavailable" (no install path).
    return (await this.provider.isAvailable()) ? 'available' : 'unavailable';
  }
}
