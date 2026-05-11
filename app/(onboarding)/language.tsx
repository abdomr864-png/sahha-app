import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  OnboardingFooter,
  OnboardingHeader,
  OnboardingHero,
  Screen,
  SelectCard,
} from '@features/shared';
import { useOnboardingStore } from '@features/onboarding';
import { setLocale, SUPPORTED_LOCALES, type AppLocale } from '@lib/i18n';

const LABELS: Record<AppLocale, { name: string; sub: string }> = {
  en: { name: 'English', sub: 'United States' },
  fr: { name: 'Français', sub: 'France' },
  ar: { name: 'العربية', sub: 'العالم العربي' },
};

export default function Language() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const setDraft = useOnboardingStore((s) => s.set);
  const draft = useOnboardingStore((s) => s.draft);

  const [picked, setPicked] = useState<AppLocale>(
    (draft.locale as AppLocale | undefined) ?? (i18n.language as AppLocale),
  );

  const onContinue = () => {
    setDraft('locale', picked);
    const { rtlChanged } = setLocale(picked);
    // If RTL flipped, setLocale will auto-reload. Don't push the next step
    // — the reload would interrupt the navigation anyway, and on next boot
    // AuthGate will route the user back into onboarding with their saved
    // draft so they pick up where they left off.
    if (rtlChanged) return;
    router.push('/(onboarding)/goal');
  };

  return (
    <Screen
      glow
      footer={
        <OnboardingFooter label={t('common.continue')} onPress={onContinue} disabled={!picked} />
      }
    >
      <OnboardingHeader step={1} total={9} showBack={false} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="globe" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.language.title')}
        </Text>
        <Text className="text-ink-subtle text-base mb-8 text-center px-2">
          {t('onboarding.language.subtitle')}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(160)} style={{ gap: 10 }}>
        {SUPPORTED_LOCALES.map((l) => (
          <SelectCard
            key={l}
            icon="globe"
            label={LABELS[l].name}
            description={LABELS[l].sub}
            selected={picked === l}
            onPress={() => setPicked(l)}
          />
        ))}
      </Animated.View>
    </Screen>
  );
}
