import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Header, Icon, Screen, useSafeBack } from '@features/shared';
import { useProfile, useUpdateProfile } from '@features/onboarding';

type Unit = 'kg' | 'lb';

const OPTIONS: { value: Unit; labelKey: string; hintKey: string }[] = [
  {
    value: 'kg',
    labelKey: 'profile.weightUnitScreen.kg',
    hintKey: 'profile.weightUnitScreen.kgHint',
  },
  {
    value: 'lb',
    labelKey: 'profile.weightUnitScreen.lb',
    hintKey: 'profile.weightUnitScreen.lbHint',
  },
];

export default function WeightUnit() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const profileQ = useProfile();
  const update = useUpdateProfile();
  const current = profileQ.data?.weight_unit ?? 'kg';

  const choose = (unit: Unit) => {
    if (unit === current) return safeBack();
    update.mutate({ weight_unit: unit }, { onSuccess: safeBack });
  };

  return (
    <Screen scroll glow padded={false}>
      <View className="px-5 pt-2">
        <Header
          title={t('profile.weightUnitScreen.title')}
          subtitle={t('profile.weightUnitScreen.subtitle')}
          onBack={safeBack}
          showBack
        />
        <View style={{ gap: 12 }}>
          {OPTIONS.map((opt) => {
            const active = current === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => choose(opt.value)}
                accessibilityRole="button"
                disabled={update.isPending}
              >
                <Card tone={active ? 'accent' : 'raised'} className={active ? 'border-accent' : ''}>
                  <View className="flex-row items-center">
                    <View
                      className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
                        active ? 'bg-accent' : 'bg-bg-subtle'
                      }`}
                    >
                      <Icon name="scale" size={20} color={active ? '#FFFFFF' : '#F4F4F5'} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-ink text-base font-extrabold">{t(opt.labelKey)}</Text>
                      <Text className="text-ink-subtle text-xs mt-0.5">{t(opt.hintKey)}</Text>
                    </View>
                    {active ? (
                      <Icon name="check-circle" size={22} color="#FF4D2E" strokeWidth={2.2} />
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
