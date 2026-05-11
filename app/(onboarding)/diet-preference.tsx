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
import type { DietPreference } from '@features/onboarding';

const DIETS: { key: DietPreference; icon: IconName }[] = [
  { key: 'omnivore', icon: 'apple' },
  { key: 'vegetarian', icon: 'leaf' },
  { key: 'vegan', icon: 'leaf' },
  { key: 'keto', icon: 'flame' },
  { key: 'low_carb', icon: 'flask' },
];

export default function DietPreferenceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);

  const [picked, setPicked] = useState<DietPreference | null>(draft.diet_preference ?? null);

  const onContinue = () => {
    if (!picked) return;
    setDraft('diet_preference', picked);
    router.push('/(onboarding)/body-stats');
  };

  return (
    <Screen
      scroll
      glow
      footer={
        <OnboardingFooter label={t('common.continue')} onPress={onContinue} disabled={!picked} />
      }
    >
      <OnboardingHeader step={8} total={9} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="apple" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.diet.title', { defaultValue: 'What do you eat?' })}
        </Text>
        <Text className="text-ink-subtle text-base mb-8 text-center px-2">
          {t('onboarding.diet.subtitle', {
            defaultValue: 'We use this to set the right macro split.',
          })}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(160)} style={{ gap: 10 }}>
        {DIETS.map((d) => (
          <SelectCard
            key={d.key}
            icon={d.icon}
            label={t(`onboarding.diet.${d.key}.label`, {
              defaultValue: defaultLabel(d.key),
            })}
            description={t(`onboarding.diet.${d.key}.desc`, {
              defaultValue: defaultDesc(d.key),
            })}
            selected={picked === d.key}
            onPress={() => setPicked(d.key)}
          />
        ))}
      </Animated.View>
    </Screen>
  );
}

function defaultLabel(k: DietPreference): string {
  switch (k) {
    case 'omnivore':
      return 'Omnivore';
    case 'vegetarian':
      return 'Vegetarian';
    case 'vegan':
      return 'Vegan';
    case 'keto':
      return 'Keto';
    case 'low_carb':
      return 'Low carb';
  }
}

function defaultDesc(k: DietPreference): string {
  switch (k) {
    case 'omnivore':
      return 'No restrictions';
    case 'vegetarian':
      return 'No meat';
    case 'vegan':
      return 'Plant-based only';
    case 'keto':
      return 'Very low carbs, high fat';
    case 'low_carb':
      return 'Reduced carbs';
  }
}
