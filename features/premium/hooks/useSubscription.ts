import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired' | null;

export interface SubscriptionRow {
  plan: string | null;
  status: SubscriptionStatus;
  expires_at: string | null;
  isPremium: boolean;
}

export function useSubscription() {
  return useQuery<SubscriptionRow>({
    queryKey: ['subscription', 'me'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      const empty: SubscriptionRow = {
        plan: null,
        status: null,
        expires_at: null,
        isPremium: false,
      };
      if (!userId) return empty;
      const { data } = await supabase
        .from('subscriptions')
        .select('plan,status,expires_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return empty;
      const status = data.status as SubscriptionStatus;
      return {
        plan: data.plan ?? null,
        status,
        expires_at: data.expires_at ?? null,
        isPremium: status === 'active' || status === 'trialing',
      };
    },
  });
}
