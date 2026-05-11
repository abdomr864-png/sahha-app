import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  OnboardingFooter,
  OnboardingHeader,
  OnboardingHero,
  Screen,
  SelectCard,
  type IconName,
} from '@features/shared';
import { useOnboardingStore } from '@features/onboarding';

type Level = 'beginner' | 'intermediate' | 'advanced';

const LEVELS: { key: Level; icon: IconName }[] = [
  { key: 'beginner', icon: 'sparkles' },
  { key: 'intermediate', icon: 'trending' },
  { key: 'advanced', icon: 'medal' },
];

export default function Experience() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);

  const [picked, setPicked] = useState<Level | null>(draft.experience_level ?? null);

  const onContinue = () => {
    if (!picked) return;
    setDraft('experience_level', picked);
    router.push('/(onboarding)/frequency');
  };

  return (
    <Screen
      glow
      footer={
        <OnboardingFooter label={t('common.continue')} onPress={onContinue} disabled={!picked} />
      }
    >
      <OnboardingHeader step={3} total={9} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="medal" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.experience.title')}
        </Text>
      </Animated.View>
      <Animated.View
        entering={FadeInDown.duration(500).delay(160)}
        style={{ gap: 10, marginTop: 8 }}
      >
        {LEVELS.map((g) => (
          <SelectCard
            key={g.key}
            icon={g.icon}
            label={t(`onboarding.experience.${g.key}`)}
            selected={picked === g.key}
            onPress={() => setPicked(g.key)}
          />
        ))}
      </Animated.View>
    </Screen>
  );
}
