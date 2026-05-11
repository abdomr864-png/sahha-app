// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from '@supabase/supabase-js';

export type EntitlementVerdict =
  | { allowed: true; remaining: number | null; isPremium: boolean }
  | { allowed: false; reason: 'premium_only' | 'limit_reached' };

const HARD_DAILY_CAP = 100;

/**
 * Server-side mirror of the client's useEntitlement. Reads subscriptions +
 * entitlement_rules + usage_counters via the admin client (bypasses RLS).
 *
 * `windowDays` lets us encode "1/week" using a 7-day rolling window even
 * though usage_counters keys by date.
 */
export async function checkEntitlement(
  admin: SupabaseClient,
  userId: string,
  feature: string,
  windowDays = 1,
): Promise<EntitlementVerdict> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPremium = sub?.status === 'active' || sub?.status === 'trialing';

  const { data: rule } = await admin
    .from('entitlement_rules')
    .select('free_daily_limit, free_total_limit, premium_only')
    .eq('feature', feature)
    .maybeSingle();

  if (!rule) return { allowed: true, remaining: null, isPremium };

  if (!isPremium && rule.premium_only) {
    return { allowed: false, reason: 'premium_only' };
  }
  if (isPremium) return { allowed: true, remaining: null, isPremium };

  const dailyLimit = (rule as any).free_daily_limit as number | null;
  const totalLimit = (rule as any).free_total_limit as number | null;
  if (dailyLimit === null && totalLimit === null) {
    return { allowed: true, remaining: null, isPremium };
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (windowDays - 1));
  const sinceIso = since.toISOString().slice(0, 10);

  const { data: counters } = await admin
    .from('usage_counters')
    .select('count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .gte('period_start', sinceIso);

  const used = (counters ?? []).reduce((s: number, c: any) => s + (c.count ?? 0), 0);
  const limit = dailyLimit ?? totalLimit ?? Number.POSITIVE_INFINITY;
  const remaining = Math.max(0, limit - used);
  if (remaining <= 0) return { allowed: false, reason: 'limit_reached' };
  return { allowed: true, remaining, isPremium };
}

/**
 * Hard ceiling across all features per user per day. Returns true if the
 * user has hit the cap.
 */
export async function isOverHardCap(admin: SupabaseClient, userId: string): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from('ai_call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString());
  return (count ?? 0) >= HARD_DAILY_CAP;
}

/** Increment the per-feature/day usage counter. */
export async function incrementUsage(
  admin: SupabaseClient,
  userId: string,
  feature: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await admin
    .from('usage_counters')
    .select('id, count')
    .eq('user_id', userId)
    .eq('feature', feature)
    .eq('period_start', today)
    .maybeSingle();

  if (existing) {
    await admin
      .from('usage_counters')
      .update({ count: (existing as any).count + 1 })
      .eq('id', (existing as any).id);
  } else {
    await admin.from('usage_counters').insert({
      user_id: userId,
      feature,
      period_start: today,
      count: 1,
    });
  }
}
