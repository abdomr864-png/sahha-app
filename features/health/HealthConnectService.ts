/** Android HealthService — binds the Health Connect provider. */
import { HealthConnectProvider } from '@lib/health-data';
import { BaseHealthService } from './service';
import type { HealthAvailability, SourcePlatform } from './types';

export class HealthConnectService extends BaseHealthService {
  readonly platform: SourcePlatform = 'android';
  readonly hubName = 'Health Connect';

  constructor() {
    super(new HealthConnectProvider());
  }

  async isAvailable(): Promise<HealthAvailability> {
    // On Android the hub IS Health Connect (bundled on Android 14+, a Play
    // Store install on older). If the provider reports it unavailable, the fix
    // is almost always "install / update Health Connect" — surface the guided
    // install path rather than a dead "unavailable".
    return (await this.provider.isAvailable()) ? 'available' : 'needs_install';
  }
}
