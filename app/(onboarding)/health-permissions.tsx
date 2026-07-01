import { useRouter } from 'expo-router';
import { Screen } from '@features/shared';
import {
  HealthPermissionFlow,
  registerHealthBackgroundSync,
  useHealthStore,
} from '@features/health';

/**
 * Onboarding step: connect health data via the new aggregation layer
 * (features/health). The trilingual, RTL-aware flow lives in
 * HealthPermissionFlow; here we just register background sync once something is
 * granted and move on to the app.
 */
export default function HealthPermissions() {
  const router = useRouter();
  const permission = useHealthStore((s) => s.permission);

  const onDone = () => {
    if (permission === 'granted' || permission === 'partial') {
      void registerHealthBackgroundSync();
    }
    router.replace('/(tabs)');
  };

  return (
    <Screen padded={false} glow>
      <HealthPermissionFlow onDone={onDone} />
    </Screen>
  );
}
