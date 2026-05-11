import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@lib/supabase/client';
import { rangeFromNow, syncRange } from './sync';

export const HEALTH_BACKGROUND_TASK = 'sahha.health-sync.background';

// 90 minutes — under iOS 30s budget per call but typically run hourly+.
const INTERVAL_SECONDS = 90 * 60;

if (!TaskManager.isTaskDefined(HEALTH_BACKGROUND_TASK)) {
  TaskManager.defineTask(HEALTH_BACKGROUND_TASK, async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return BackgroundFetch.BackgroundFetchResult.NoData;
      // Cap background work at the last 24h — never backfill in background.
      const range = rangeFromNow(1);
      const result = await syncRange(userId, range);
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
    // Already unregistered.
  }
}
