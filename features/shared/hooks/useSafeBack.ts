import { useCallback } from 'react';
import { useRouter } from 'expo-router';

// Back affordances always return the user to the home tab rather than popping
// the navigation stack — product decision, see DECISIONS.md.
export function useSafeBack(_fallback?: string) {
  const router = useRouter();
  return useCallback(() => {
    router.replace('/(tabs)' as never);
  }, [router]);
}
