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
import type { GoalPace } from '@features/onboarding';

const PACES: { key: GoalPace; icon: IconName }[] = [
  { key: 'slow', icon: 'leaf' },
  { key: 'standard', icon: 'target' },
  { key: 'aggressive', icon: 'flame' },
];

export default function GoalPaceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);

  const [picked, setPicked] = useState<GoalPace | null>(draft.goal_pace ?? null);

  const onContinue = () => {
    if (!picked) return;
    setDraft('goal_pace', picked);
    router.push('/(onboarding)/diet-preference');
  };

  return (
    <Screen
      scroll
      glow
      footer={
        <OnboardingFooter label={t('common.continue')} onPress={onContinue} disabled={!picked} />
      }
    >
      <OnboardingHeader step={7} total={9} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="zap" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.goalPace.title', { defaultValue: 'How fast do you want to progress?' })}
        </Text>
        <Text className="text-ink-subtle text-base mb-8 text-center px-2">
          {t('onboarding.goalPace.subtitle', {
            defaultValue: 'Faster = bigger calorie shift each day.',
          })}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(160)} style={{ gap: 10 }}>
        {PACES.map((p) => (
          <SelectCard
            key={p.key}
            icon={p.icon}
            label={t(`onboarding.goalPace.${p.key}.label`, {
              defaultValue: defaultLabel(p.key),
            })}
            description={t(`onboarding.goalPace.${p.key}.desc`, {
              defaultValue: defaultDesc(p.key),
            })}
            selected={picked === p.key}
            onPress={() => setPicked(p.key)}
          />
        ))}
      </Animated.View>
    </Screen>
  );
}

function defaultLabel(k: GoalPace): string {
  switch (k) {
    case 'slow':
      return 'Steady';
    case 'standard':
      return 'Balanced';
    case 'aggressive':
      return 'Aggressive';
  }
}

function defaultDesc(k: GoalPace): string {
  switch (k) {
    case 'slow':
      return '~250 kcal/day shift • easiest to sustain';
    case 'standard':
      return '~500 kcal/day shift • recommended';
    case 'aggressive':
      return '~750 kcal/day shift • requires discipline';
  }
}
