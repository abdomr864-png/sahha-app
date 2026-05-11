import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';
import type { Entitlement, Feature } from '../types';

/**
 * Reads the rule for `feature` and the user's current usage + subscription
 * status to decide if access is allowed. See D14: this is read-only in pass 1
 * — full purchase + restore lands in pass 2.
 */
export function useEntitlement(feature: Feature) {
  return useQuery<Entitlement>({
    queryKey: ['entitlement', feature],
    staleTime: 60_000,
    queryFn: async () => resolveEntitlement(feature),
  });
}

async function resolveEntitlement(feature: Feature): Promise<Entitlement> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) {
    // DEV BYPASS: server-side functions also bypass auth in dev so AI features
    // can be tested without sign-in. Return `allowed: true` so the UI doesn't
    // block the user. Re-tighten when auth is restored end-to-end.
    return { feature, allowed: true, remaining: null };
  }

  const sub = (await mapSb(
    supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ).catch(() => null)) as { status: string } | null;

  const isPremium = sub?.status === 'active' || sub?.status === 'trialing';
  if (isPremium) return { feature, allowed: true, remaining: null };

  const rule = (await mapSb(
    supabase
      .from('entitlement_rules')
      .select('free_daily_limit, free_total_limit, premium_only')
      .eq('feature', feature)
      .maybeSingle(),
  ).catch(() => null)) as {
    free_daily_limit: number | null;
    free_total_limit: number | null;
    premium_only: boolean;
  } | null;

  if (!rule) return { feature, allowed: true, remaining: null };
  if (rule.premium_only) {
    return { feature, allowed: false, reason: 'premium_only', remaining: 0 };
  }

  const dailyLimit = rule.free_daily_limit ?? null;
  const totalLimit = rule.free_total_limit ?? null;
  if (dailyLimit === null && totalLimit === null) {
    return { feature, allowed: true, remaining: null };
  }

  const today = new Date().toISOString().slice(0, 10);
  const counter = (await mapSb(
    supabase
      .from('usage_counters')
      .select('count')
      .eq('user_id', userId)
      .eq('feature', feature)
      .eq('period_start', today)
      .maybeSingle(),
  ).catch(() => null)) as { count: number } | null;

  const used = counter?.count ?? 0;
  const limit = dailyLimit ?? totalLimit ?? Infinity;
  const remaining = Math.max(0, limit - used);
  if (remaining <= 0) {
    return { feature, allowed: false, reason: 'limit_reached', remaining: 0 };
  }
  return { feature, allowed: true, remaining };
}
