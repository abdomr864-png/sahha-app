import { useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { OnboardingFooter, OnboardingHeader, OnboardingHero, Screen } from '@features/shared';
import { useOnboardingStore } from '@features/onboarding';

const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const SUBTITLES: Record<number, string> = {
  2: 'Light & sustainable',
  3: 'Solid foundation',
  4: 'Recommended for most',
  5: 'High volume',
  6: 'Hardcore',
};

export default function Frequency() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);

  const [picked, setPicked] = useState<number | null>(draft.training_days_per_week ?? null);

  const onContinue = () => {
    if (picked == null) return;
    setDraft('training_days_per_week', picked);
    router.push('/(onboarding)/equipment');
  };

  return (
    <Screen
      scroll
      glow
      footer={
        <OnboardingFooter
          label={t('common.continue')}
          onPress={onContinue}
          disabled={picked == null}
        />
      }
    >
      <OnboardingHeader step={4} total={9} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="calendar" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.frequency.title')}
        </Text>
      </Animated.View>
      <Animated.View
        entering={FadeInDown.duration(500).delay(160)}
        className="flex-row flex-wrap"
        style={{ gap: 10, marginTop: 8 }}
      >
        {[2, 3, 4, 5, 6].map((n) => {
          const active = picked === n;
          return (
            <Pressable
              key={n}
              onPress={() => setPicked(n)}
              style={
                active
                  ? {
                      shadowColor: '#FF4D2E',
                      shadowOpacity: 0.4,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: 8 },
                    }
                  : undefined
              }
              className={`relative overflow-hidden flex-1 min-w-[100px] rounded-2xl border px-4 py-5 items-center ${
                active ? 'border-accent' : 'bg-bg-raised border-border'
              }`}
            >
              {active ? (
                <LinearGradient
                  colors={['rgba(255,77,46,0.22)', 'rgba(255,77,46,0.05)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  pointerEvents="none"
                />
              ) : null}
              <Text
                className={`text-5xl font-extrabold ${active ? 'text-accent' : 'text-ink'}`}
                style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
              >
                {n}
              </Text>
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest mt-1">
                DAYS / WEEK
              </Text>
              <Text className="text-ink-subtle text-xs mt-2 text-center">{SUBTITLES[n]}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </Screen>
  );
}
