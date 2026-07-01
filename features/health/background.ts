/**
 * Background health sync. Registers one TaskManager task (via expo-background-
 * fetch / WorkManager on Android, BGTaskScheduler on iOS) that runs syncAll for
 * the signed-in user. Idempotent + safe on cold start.
 *
 * Android background READS additionally require the runtime permission
 * `health.READ_HEALTH_DATA_IN_BACKGROUND` (Android 14+) declared in the
 * manifest and granted by the user — see HEALTH_SETUP.md.
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@lib/supabase/client';
import { getHealthService } from './resolve';

export const HEALTH_BACKGROUND_TASK = 'sahha.health.sync.v2';

// Legacy task from features/wearables — unregistered on supersede so we don't
// run two health-sync tasks writing to two table sets.
const LEGACY_TASK = 'sahha.health-sync.background';

// ~90 min target cadence. The OS decides the real schedule; keep work small.
const INTERVAL_SECONDS = 90 * 60;

if (!TaskManager.isTaskDefined(HEALTH_BACKGROUND_TASK)) {
  TaskManager.defineTask(HEALTH_BACKGROUND_TASK, async () => {
    try {
      const service = getHealthService();
      if (!service) return BackgroundFetch.BackgroundFetchResult.NoData;

      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return BackgroundFetch.BackgroundFetchResult.NoData;

      const result = await service.syncAll(userId);
      const wrote = Object.values(result.counts).some((n) => (n ?? 0) > 0);
      return wrote
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerHealthBackgroundSync(): Promise<void> {
  try {
    // Retire the legacy wearables task if it's still registered.
    if (await TaskManager.isTaskRegisteredAsync(LEGACY_TASK)) {
      await BackgroundFetch.unregisterTaskAsync(LEGACY_TASK).catch(() => undefined);
    }
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) return;
    await BackgroundFetch.registerTaskAsync(HEALTH_BACKGROUND_TASK, {
      minimumInterval: INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Best-effort; foreground sync covers the gap.
  }
}

export async function unregisterHealthBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(HEALTH_BACKGROUND_TASK);
  } catch {
    // Already unregistered / never registered.
  }
}
