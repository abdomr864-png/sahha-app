/**
 * Resolves a feature flag = local default (config.ts) overridden by the optional
 * remote `feature_flags` table. Designed to never block or crash:
 *   - The local default is returned synchronously on first render.
 *   - The remote table is fetched once (5-min stale) and, if reachable, its rows
 *     override the local defaults. Offline / error → the last cached remote map
 *     (persisted to storage), then the local defaults. Never throws to the UI.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { storage } from '@lib/offline/storage';
import { FEATURE_FLAGS, type FeatureFlagKey } from '../config';

type RemoteFlags = Partial<Record<FeatureFlagKey, boolean>>;

const CACHE_KEY = 'feature-flags.remote';
const QUERY_KEY = ['feature-flags'] as const;

function readCachedRemote(): RemoteFlags {
  return storage.getJSON<RemoteFlags>(CACHE_KEY) ?? {};
}

async function fetchRemoteFlags(): Promise<RemoteFlags> {
  try {
    const { data, error } = await supabase.from('feature_flags').select('key, enabled');
    if (error) throw error;
    const map: RemoteFlags = {};
    for (const row of (data ?? []) as { key: string; enabled: boolean }[]) {
      // Only keep keys we actually know about, so a stray remote row can't
      // introduce an untyped flag.
      if (row.key in FEATURE_FLAGS) map[row.key as FeatureFlagKey] = row.enabled;
    }
    storage.setJSON(CACHE_KEY, map);
    return map;
  } catch {
    // Offline or RLS hiccup — fall back to whatever we last saw.
    return readCachedRemote();
  }
}

/** Reactive remote-flag map; safe to call once and read many keys from it. */
export function useRemoteFlags() {
  return useQuery<RemoteFlags>({
    queryKey: QUERY_KEY,
    staleTime: 5 * 60_000,
    initialData: readCachedRemote,
    queryFn: fetchRemoteFlags,
  });
}

/**
 * `true` when the cluster is enabled. Remote override wins when present;
 * otherwise the typed local default. Gate every Pro cluster's entry point on
 * this before doing any work or rendering its surface.
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const { data } = useRemoteFlags();
  const remote = data?.[key];
  return remote ?? FEATURE_FLAGS[key];
}
