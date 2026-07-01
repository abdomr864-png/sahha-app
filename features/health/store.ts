/**
 * useHealthStore — UI-facing health state: availability, permission status,
 * last sync time, in-flight flag, and the last error. Device I/O is delegated
 * to the resolved HealthService; this store only orchestrates + caches status.
 */
import { create } from 'zustand';
import { supabase } from '@lib/supabase/client';
import { getHealthService } from './resolve';
import { HealthError, type HealthAvailability, type HealthPermissionStatus } from './types';

interface HealthState {
  availability: HealthAvailability | 'unknown';
  permission: HealthPermissionStatus | 'unknown';
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;

  refreshStatus: () => Promise<void>;
  requestPermissions: () => Promise<HealthPermissionStatus>;
  syncNow: () => Promise<void>;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  availability: 'unknown',
  permission: 'unknown',
  lastSyncAt: null,
  syncing: false,
  error: null,

  refreshStatus: async () => {
    const service = getHealthService();
    if (!service) {
      set({ availability: 'unavailable', permission: 'denied' });
      return;
    }
    try {
      const [availability, permission] = await Promise.all([
        service.isAvailable(),
        service.getPermissionStatus(),
      ]);
      set({ availability, permission, error: null });
    } catch (e) {
      set({ error: (e as Error)?.message ?? 'status_failed' });
    }
  },

  requestPermissions: async () => {
    const service = getHealthService();
    if (!service) {
      set({ permission: 'denied' });
      return 'denied';
    }
    try {
      const permission = await service.requestPermissions();
      set({ permission, error: null });
      // Kick an initial sync as soon as something is granted.
      if (permission === 'granted' || permission === 'partial') void get().syncNow();
      return permission;
    } catch (e) {
      set({ error: (e as Error)?.message ?? 'permission_failed' });
      return 'denied';
    }
  },

  syncNow: async () => {
    const service = getHealthService();
    if (!service || get().syncing) return;
    const userId = await currentUserId();
    if (!userId) {
      set({ error: 'not_authenticated' });
      return;
    }
    set({ syncing: true, error: null });
    try {
      const result = await service.syncAll(userId);
      const firstError = Object.values(result.errors)[0] ?? null;
      set({ lastSyncAt: result.syncedAt, error: firstError });
    } catch (e) {
      const msg = e instanceof HealthError ? e.code : ((e as Error)?.message ?? 'sync_failed');
      set({ error: msg });
    } finally {
      set({ syncing: false });
    }
  },
}));
