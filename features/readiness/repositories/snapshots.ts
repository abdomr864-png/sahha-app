/**
 * Persistence for daily readiness snapshots. One row per user per local day,
 * upserted on (user_id, date). The new table isn't in the hand-written
 * database.types stub yet, so we use the same loosened-typing escape hatch as
 * useRecovery (workouts) until `supabase gen types` is wired.
 */
import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import type { ReadinessState } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in stub types
const db = supabase as any;

export interface ReadinessSnapshotRow {
  user_id: string;
  date: string; // YYYY-MM-DD, local day
  recovery_score: number | null;
  acwr: number | null;
  training_load: number | null;
  state: ReadinessState;
  load_multiplier: number;
  rpe_cap: number | null;
  inputs: Record<string, unknown>;
}

const COLUMNS =
  'user_id,date,recovery_score,acwr,training_load,state,load_multiplier,rpe_cap,inputs';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** Today's persisted snapshot (the last cached verdict), or null. */
export async function fetchSnapshot(localDate: string): Promise<ReadinessSnapshotRow | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await db
    .from('readiness_snapshots')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('date', localDate)
    .maybeSingle();
  if (error) throw toAppError(error);
  return (data as ReadinessSnapshotRow | null) ?? null;
}

/** Upsert today's snapshot. No-op when signed out (verdict still renders). */
export async function upsertSnapshot(row: Omit<ReadinessSnapshotRow, 'user_id'>): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await db
    .from('readiness_snapshots')
    .upsert({ ...row, user_id: userId }, { onConflict: 'user_id,date' });
  if (error) throw toAppError(error);
}
