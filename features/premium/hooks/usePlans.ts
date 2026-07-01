import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: 'month' | 'year' | 'one_time' | string;
  sub_plan: string | null;
  features: string[] | null;
  badge: string | null;
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
}

/**
 * Live pricing tiers managed from the admin panel (`plans` table). The paywall
 * falls back to its hard-coded defaults when this returns empty/unavailable, so
 * the screen always renders even offline or before the table is seeded.
 */
export function usePlans() {
  return useQuery<PlanRow[]>({
    queryKey: ['plans', 'active'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select(
          'id,name,description,price,currency,billing_interval,sub_plan,features,badge,highlight,is_active,sort_order',
        )
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });
}
