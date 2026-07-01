import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { installWorkoutOfflineRunner } from '@features/workouts';
import { TabBar } from '@features/shared';

// Force the home tab as the entry route on every cold launch â€” overrides
// any persisted nav state so the app doesn't flash the previous tab first.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function TabsLayout() {
  const { t } = useTranslation();

  useEffect(() => {
    installWorkoutOfflineRunner();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#0A0A0F' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="feed" options={{ title: t('tabs.feed') }} />
      <Tabs.Screen name="coach" options={{ title: t('tabs.coach', 'Coach') }} />
      <Tabs.Screen name="progress" options={{ title: t('tabs.progress') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
