/**
 * syncAll orchestration: for each provider data type, read its cursor from
 * `health_sync_state`, pull changes since then via the service, dedup, batch
 * upsert into `health_metrics`, and advance the cursor. Idempotent and safe to
 * run on cold start or in the background — re-running never duplicates because
 * the upsert conflict key is (user_id, metric_type, external_id).
 */
import { supabase } from '@lib/supabase/client';
import { dedupeRows } from './mapper';
import type { HealthService } from './service';
import {
  HealthError,
  PROVIDER_TYPES_FOR_SYNC,
  type HealthMetricRow,
  type HealthSyncResult,
  type MetricType,
} from './types';

// health_metrics / health_sync_state are newer than the generated Supabase
// types; loosen typing here (same escape hatch used elsewhere in the app).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const UPSERT_CHUNK = 500;

export async function runSyncAll(
  service: HealthService,
  userId: string,
): Promise<HealthSyncResult> {
  const counts: HealthSyncResult['counts'] = {};
  const errors: HealthSyncResult['errors'] = {};

  for (const type of PROVIDER_TYPES_FOR_SYNC) {
    try {
      const cursor = await readCursor(userId, service.platform, type);
      const { rows, token } = await service.readChanges(type, cursor, userId);
      const deduped = dedupeRows(rows);
      await upsertMetrics(deduped);
      for (const r of deduped) counts[r.metric_type] = (counts[r.metric_type] ?? 0) + 1;
      await writeCursor(userId, service.platform, type, token);
    } catch (e) {
      // Partial failure (e.g. one denied type) must not abort the whole sync.
      const code = e instanceof HealthError ? e.code : 'read_failed';
      errors[type as unknown as MetricType] = `${code}: ${(e as Error)?.message ?? 'unknown'}`;
    }
  }

  return { counts, errors, syncedAt: new Date().toISOString() };
}

async function upsertMetrics(rows: HealthMetricRow[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const batch = rows.slice(i, i + UPSERT_CHUNK);
    const { error } = await db
      .from('health_metrics')
      .upsert(batch, { onConflict: 'user_id,metric_type,external_id', ignoreDuplicates: false });
    if (error) throw new HealthError('persist_failed', error.message);
  }
}

/** Last cursor (ISO timestamp) for this user/platform/provider-type, or null. */
async function readCursor(
  userId: string,
  platform: string,
  // `metric_type` here holds the PROVIDER data type (steps, hrv, sleep, …) —
  // the read granularity — not the normalized metric_type.
  providerType: string,
): Promise<string | null> {
  const { data } = await db
    .from('health_sync_state')
    .select('last_synced_at')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('metric_type', providerType)
    .maybeSingle();
  return (data as { last_synced_at: string | null } | null)?.last_synced_at ?? null;
}

async function writeCursor(
  userId: string,
  platform: string,
  providerType: string,
  token: string,
): Promise<void> {
  await db.from('health_sync_state').upsert(
    {
      user_id: userId,
      platform,
      metric_type: providerType,
      last_synced_at: token,
      // sync_token reserved for a future native HK anchor / HC changes token.
      sync_token: null,
    },
    { onConflict: 'user_id,platform,metric_type' },
  );
}
