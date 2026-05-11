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

type GoalKey = 'hypertrophy' | 'strength' | 'recomp' | 'general';

const GOALS: { key: GoalKey; icon: IconName }[] = [
  { key: 'hypertrophy', icon: 'dumbbell' },
  { key: 'strength', icon: 'zap' },
  { key: 'recomp', icon: 'flame' },
  { key: 'general', icon: 'target' },
];

export default function Goal() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);

  const [picked, setPicked] = useState<GoalKey | null>(draft.goal ?? null);

  const onContinue = () => {
    if (!picked) return;
    setDraft('goal', picked);
    router.push('/(onboarding)/experience');
  };

  return (
    <Screen
      scroll
      glow
      footer={
        <OnboardingFooter label={t('common.continue')} onPress={onContinue} disabled={!picked} />
      }
    >
      <OnboardingHeader step={2} total={9} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="target" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.goal.title')}
        </Text>
        <Text className="text-ink-subtle text-base mb-8 text-center px-2">
          Pick the one that fits — you can change it later.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(160)} style={{ gap: 10 }}>
        {GOALS.map((g) => (
          <SelectCard
            key={g.key}
            icon={g.icon}
            label={t(`onboarding.goal.${g.key}`)}
            selected={picked === g.key}
            onPress={() => setPicked(g.key)}
          />
        ))}
      </Animated.View>
    </Screen>
  );
}
