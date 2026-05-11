import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';

export function useIsAdmin() {
  return useQuery<boolean>({
    queryKey: ['is-admin'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const id = u?.user?.id;
      if (!id) return false;
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', id)
        .maybeSingle();
      return !!(data as { is_admin?: boolean } | null)?.is_admin;
    },
  });
}
