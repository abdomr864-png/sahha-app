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
import type { ActivityLevel } from '@features/onboarding';

const LEVELS: { key: ActivityLevel; icon: IconName }[] = [
  { key: 'sedentary', icon: 'home' },
  { key: 'light', icon: 'leaf' },
  { key: 'moderate', icon: 'trending' },
  { key: 'very', icon: 'flame' },
  { key: 'extra', icon: 'zap' },
];

export default function ActivityLevelScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);

  const [picked, setPicked] = useState<ActivityLevel | null>(draft.activity_level ?? null);

  const onContinue = () => {
    if (!picked) return;
    setDraft('activity_level', picked);
    router.push('/(onboarding)/goal-pace');
  };

  return (
    <Screen
      scroll
      glow
      footer={
        <OnboardingFooter label={t('common.continue')} onPress={onContinue} disabled={!picked} />
      }
    >
      <OnboardingHeader step={6} total={9} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="flame" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.activityLevel.title', {
            defaultValue: 'How active are you outside training?',
          })}
        </Text>
        <Text className="text-ink-subtle text-base mb-8 text-center px-2">
          {t('onboarding.activityLevel.subtitle', {
            defaultValue: 'Daily movement — desk job, walks, kids, etc.',
          })}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(160)} style={{ gap: 10 }}>
        {LEVELS.map((l) => (
          <SelectCard
            key={l.key}
            icon={l.icon}
            label={t(`onboarding.activityLevel.${l.key}.label`, {
              defaultValue: defaultLabel(l.key),
            })}
            description={t(`onboarding.activityLevel.${l.key}.desc`, {
              defaultValue: defaultDesc(l.key),
            })}
            selected={picked === l.key}
            onPress={() => setPicked(l.key)}
          />
        ))}
      </Animated.View>
    </Screen>
  );
}

function defaultLabel(k: ActivityLevel): string {
  switch (k) {
    case 'sedentary':
      return 'Sedentary';
    case 'light':
      return 'Lightly active';
    case 'moderate':
      return 'Moderately active';
    case 'very':
      return 'Very active';
    case 'extra':
      return 'Extra active';
  }
}

function defaultDesc(k: ActivityLevel): string {
  switch (k) {
    case 'sedentary':
      return 'Mostly sitting, little walking';
    case 'light':
      return 'Some walking, light chores';
    case 'moderate':
      return 'On your feet, regular movement';
    case 'very':
      return 'Physical job or daily exercise';
    case 'extra':
      return 'Athlete or hard manual labor';
  }
}
