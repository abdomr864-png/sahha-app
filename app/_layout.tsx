import '../global.css';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useFonts } from 'expo-font';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { HankenGrotesk_500Medium, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { initI18n } from '@lib/i18n';
import { supabase } from '@lib/supabase/client';
import { AuthGateSheet, useSession } from '@features/auth';
import { useOnboardingStore, usePrefetchProfile } from '@features/onboarding';
// Direct module import (not the @features/strength barrel) keeps the strength
// screen graph out of the app entry route; the overlay only needs the store.
import { LevelUpCelebration } from '@features/strength/components/LevelUpCelebration';
import { useWatchBridge } from '@features/watch';

// Force-route to "/" (which redirects to home) on every cold launch.
// Prevents the brief flash of the previously-open tab.
export const unstable_settings = {
  initialRouteName: 'index',
};

initI18n();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  // Load the Sahha display + body fonts. Rendering is intentionally NOT gated
  // on this: text falls back to System until the fonts resolve, then swaps in.
  useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    HankenGrotesk_500Medium,
    HankenGrotesk_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setVisibilityAsync('hidden').catch(() => undefined);
    NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        <QueryClientProvider client={queryClient}>
          <AuthGate />
          <AuthGateSheet />
          <LevelUpCelebration />
          <WatchBridgeMount />
          <StatusBar hidden />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Mounts the phone↔watch bridge once for the app's lifetime. Renders nothing.
 * No-ops on platforms/builds without the native WatchConnectivity module.
 */
function WatchBridgeMount() {
  useWatchBridge();
  return null;
}

function AuthGate() {
  const { session } = useSession();
  const segments = useSegments();
  const root = segments[0];
  const inAuth = root === '(auth)';
  const inOnboarding = root === '(onboarding)';
  const inTabs = root === '(tabs)';
  const landed = useRef(false);
  const ensureOwner = useOnboardingStore((s) => s.ensureOwner);

  const userId = session?.user?.id;
  // Reset the local onboarding draft if it was started by a different user.
  // Member A's partial answers must not leak into member B on the same device.
  useEffect(() => {
    ensureOwner(userId ?? null);
  }, [ensureOwner, userId]);
  // Warm the profile cache so the Profile tab renders with data on first open
  // instead of flashing placeholders while the query resolves.
  usePrefetchProfile(userId ?? null);
  // `goal` is null until the user finishes onboarding (useCompleteOnboarding
  // upserts it). Treat null/missing as "needs onboarding".
  const onboarded = useQuery({
    queryKey: ['auth-gate-onboarded', userId ?? 'anon'],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('goal')
        .eq('user_id', userId!)
        .maybeSingle();
      return !!data?.goal;
    },
  });

  // 1) Session not yet resolved → blank splash. No previous route renders.
  if (session === undefined) {
    return <View style={{ flex: 1, backgroundColor: '#0A0A0F' }} />;
  }

  // 2) Signed-out users can browse the app freely. The (auth) routes are
  //    still reachable when a feature explicitly needs login (the gate
  //    sheet pushes them there). Only redirect away from (onboarding) since
  //    onboarding has no meaning without a user.
  if (!session && inOnboarding) {
    return <Redirect href="/(tabs)/" />;
  }

  // 3) Signed-in but onboarding status unknown → splash. Avoids a flash of
  //    tabs before we route a brand-new user into onboarding.
  if (session && (onboarded.isPending || onboarded.fetchStatus === 'fetching')) {
    return <View style={{ flex: 1, backgroundColor: '#0A0A0F' }} />;
  }

  const needsOnboarding = !!session && onboarded.data === false;

  // 4) Onboarded user somehow back inside (onboarding) → home. Guarantees
  //    the quiz only ever runs once per user — they cannot re-enter it.
  //    Signed-in users on (auth) are NOT auto-bounced: the welcome / sign-in
  //    pages must stay reachable (e.g. tapping "Se connecter" from welcome).
  //    Post-authentication redirects to tabs are issued by sign-in.tsx /
  //    sign-up.tsx / useSocialAuth callers, not here.
  if (session && !needsOnboarding && inOnboarding) {
    return <Redirect href="/(tabs)/" />;
  }

  // 6) Cold-launch outside the tab root → force home regardless of auth
  //    state. Without this, expo-router can restore the last-visited screen
  //    (e.g. /exercise-picker, /session) on app start instead of landing
  //    the user on the home tab.
  if (!landed.current && !inAuth && !inOnboarding) {
    landed.current = true;
    if (!inTabs || (segments as string[])[1]) {
      return <Redirect href="/(tabs)/" />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0F' } }} />
  );
}
