import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { ALL_HEALTH_TYPES, getHealthDataProvider, type HealthDataType } from '@lib/health-data';
import { rangeFromNow, syncRange, type SyncResult } from '../services/sync';
import { useSession } from '@features/auth';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'no_permission' | 'unavailable';

export interface HealthSyncSettingsRow {
  user_id: string;
  enabled_types: HealthDataType[];
  ai_biometrics_optin: boolean;
  last_synced_at: string | null;
  permission_revoked: boolean;
}

const BACKFILL_DAYS = 30;
const FOREGROUND_DAYS = 1;

export function useHealthSyncSettings() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['healthSyncSettings', userId],
    enabled: !!userId,
    queryFn: async (): Promise<HealthSyncSettingsRow | null> => {
      if (!userId) return null;
      const { data } = await supabase
        .from('health_sync_settings')
        .select('user_id, enabled_types, ai_biometrics_optin, last_synced_at, permission_revoked')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as HealthSyncSettingsRow | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useUpdateSyncSettings() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<HealthSyncSettingsRow, 'enabled_types' | 'ai_biometrics_optin' | 'permission_revoked'>
      >,
    ) => {
      if (!session) throw new Error('unauthenticated');
      const { error } = await supabase.from('health_sync_settings').upsert(
        {
          user_id: session.user.id,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['healthSyncSettings'] }),
  });
}

export function useHealthSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  const settings = useHealthSyncSettings().data;
  const qc = useQueryClient();

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const inFlight = useRef(false);

  const sync = useCallback(
    async (mode: 'foreground' | 'backfill' = 'foreground') => {
      if (!userId || inFlight.current) return null;
      inFlight.current = true;
      setStatus('syncing');
      try {
        const provider = getHealthDataProvider();
        if (!(await provider.isAvailable())) {
          setStatus('unavailable');
          return null;
        }
        const types = (settings?.enabled_types ?? ALL_HEALTH_TYPES) as HealthDataType[];
        const range = rangeFromNow(mode === 'backfill' ? BACKFILL_DAYS : FOREGROUND_DAYS);
        const result = await syncRange(userId, range, types, provider);
        setLastResult(result);
        setStatus('success');
        qc.invalidateQueries({ queryKey: ['healthSyncSettings'] });
        qc.invalidateQueries({ queryKey: ['wearables'] });
        return result;
      } catch {
        setStatus('error');
        return null;
      } finally {
        inFlight.current = false;
      }
    },
    [userId, settings?.enabled_types, qc],
  );

  const requestPermissions = useCallback(async (types: HealthDataType[] = ALL_HEALTH_TYPES) => {
    const provider = getHealthDataProvider();
    if (!(await provider.isAvailable())) {
      setStatus('unavailable');
      return { status: 'denied' as const, granted: {} };
    }
    const result = await provider.requestPermissions(types);
    if (result.status !== 'granted') setStatus('no_permission');
    return result;
  }, []);

  // Foreground sync trigger: re-sync when app becomes active.
  useEffect(() => {
    if (!userId) return;
    const onChange = (s: AppStateStatus) => {
      if (s === 'active') void sync('foreground');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [userId, sync]);

  return {
    status,
    lastResult,
    lastSyncedAt: settings?.last_synced_at ?? null,
    sync,
    requestPermissions,
  };
}
