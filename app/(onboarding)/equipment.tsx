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

type EquipKey = 'full_gym' | 'home_gym' | 'minimal';

const OPTS: {
  key: EquipKey;
  label: string;
  icon: IconName;
  desc: string;
}[] = [
  { key: 'full_gym', label: 'fullGym', icon: 'dumbbell', desc: 'Barbells, machines, racks' },
  { key: 'home_gym', label: 'homeGym', icon: 'home', desc: 'Dumbbells, bench, basics' },
  { key: 'minimal', label: 'minimal', icon: 'zap', desc: 'No equipment needed' },
];

export default function Equipment() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setDraft = useOnboardingStore((s) => s.set);

  const [picked, setPicked] = useState<EquipKey | null>(draft.equipment_access ?? null);

  const onContinue = () => {
    if (!picked) return;
    setDraft('equipment_access', picked);
    router.push('/(onboarding)/activity-level');
  };

  return (
    <Screen
      glow
      footer={
        <OnboardingFooter label={t('common.continue')} onPress={onContinue} disabled={!picked} />
      }
    >
      <OnboardingHeader step={5} total={9} />
      <Animated.View entering={FadeIn.duration(500)}>
        <OnboardingHero icon="dumbbell" />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(500).delay(80)}>
        <Text className="text-ink text-4xl font-extrabold tracking-tight leading-tight mb-3 text-center">
          {t('onboarding.equipment.title')}
        </Text>
      </Animated.View>
      <Animated.View
        entering={FadeInDown.duration(500).delay(160)}
        style={{ gap: 10, marginTop: 8 }}
      >
        {OPTS.map((o) => (
          <SelectCard
            key={o.key}
            icon={o.icon}
            label={t(`onboarding.equipment.${o.label}`)}
            description={o.desc}
            selected={picked === o.key}
            onPress={() => setPicked(o.key)}
          />
        ))}
      </Animated.View>
    </Screen>
  );
}
