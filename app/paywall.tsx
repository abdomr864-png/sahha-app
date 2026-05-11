import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Icon,
  IconButton,
  Screen,
  useSafeBack,
  type IconName,
} from '@features/shared';
import { useSubscription } from '@features/premium';

type Plan = 'monthly' | 'yearly';

interface Feature {
  icon: IconName;
  key: string;
}

const FEATURES: Feature[] = [
  { icon: 'sparkles', key: 'ai_unlimited' },
  { icon: 'zap', key: 'programs' },
  { icon: 'heart', key: 'biometrics' },
  { icon: 'image', key: 'progress' },
  { icon: 'medal', key: 'priority' },
];

export default function Paywall() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const sub = useSubscription();
  const [plan, setPlan] = useState<Plan>('yearly');

  const isPremium = sub.data?.isPremium ?? false;
  const expiresAt = sub.data?.expires_at;

  const onPurchase = () => {
    Alert.alert(t('premium.paywall.title'), t('premium.paywall.comingSoon'), [{ text: 'OK' }]);
  };

  const onRestore = () => {
    Alert.alert(t('premium.paywall.restore'), t('premium.paywall.comingSoon'));
  };

  return (
    <Screen scroll glow padded={false}>
      <View className="px-5 pt-2">
        <View className="flex-row justify-end mb-2">
          <IconButton icon="x" onPress={safeBack} />
        </View>

        {/* Hero */}
        <View className="items-center mb-6">
          <View
            className="w-20 h-20 rounded-3xl bg-accent items-center justify-center mb-4"
            style={{
              shadowColor: '#FF4D2E',
              shadowOpacity: 0.55,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            }}
          >
            <Icon name="crown" size={36} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text className="text-ink text-3xl font-extrabold tracking-tight text-center">
            {t('premium.paywall.title')}
          </Text>
          <Text className="text-ink-subtle text-sm mt-2 text-center px-6">
            {t('premium.paywall.tagline')}
          </Text>

          {isPremium ? (
            <View className="mt-4 flex-row items-center bg-success/15 border border-success/40 rounded-full px-4 py-1.5">
              <Icon name="check-circle" size={14} color="#34D399" />
              <Text className="text-success ml-1.5 text-xs font-bold tracking-wider uppercase">
                {sub.data?.status === 'trialing'
                  ? t('premium.paywall.trialing')
                  : t('premium.paywall.active')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Features */}
        <Card tone="raised" className="mb-6">
          <View style={{ gap: 14 }}>
            {FEATURES.map((f) => (
              <View key={f.key} className="flex-row items-center">
                <View className="w-9 h-9 rounded-xl bg-accent/15 items-center justify-center mr-3">
                  <Icon name={f.icon} size={16} color="#FF4D2E" />
                </View>
                <Text className="text-ink text-sm font-semibold flex-1">
                  {t(`premium.paywall.features.${f.key}`)}
                </Text>
                <Icon name="check" size={16} color="#34D399" strokeWidth={2.4} />
              </View>
            ))}
          </View>
        </Card>

        {/* Plan switcher */}
        {!isPremium ? (
          <>
            <View className="flex-row mb-6" style={{ gap: 10 }}>
              <PlanCard
                active={plan === 'yearly'}
                onPress={() => setPlan('yearly')}
                label={t('premium.paywall.yearly')}
                price="$59.99"
                unit={t('premium.paywall.perYear')}
                badge={t('premium.paywall.save', { percent: 50 })}
              />
              <PlanCard
                active={plan === 'monthly'}
                onPress={() => setPlan('monthly')}
                label={t('premium.paywall.monthly')}
                price="$9.99"
                unit={t('premium.paywall.perMonth')}
              />
            </View>

            <Button label={t('premium.paywall.cta')} icon="sparkles" onPress={onPurchase} />

            <Pressable onPress={onRestore} className="mt-4 self-center">
              <Text className="text-ink-subtle text-xs font-semibold underline">
                {t('premium.paywall.restore')}
              </Text>
            </Pressable>

            <Text className="text-ink-muted text-[11px] text-center mt-5 px-4 leading-4">
              {t('premium.paywall.terms')}
            </Text>
          </>
        ) : (
          <>
            <Card className="mb-4">
              <View className="flex-row items-center">
                <Icon name="calendar" size={16} color="#A1A1AA" />
                <Text className="text-ink-subtle text-sm ml-2">
                  {expiresAt
                    ? t('premium.paywall.expires', {
                        when: new Date(expiresAt).toLocaleDateString(),
                      })
                    : t('premium.paywall.active')}
                </Text>
              </View>
            </Card>
            <Button label={t('premium.paywall.back')} variant="secondary" onPress={safeBack} />
          </>
        )}

        <View style={{ height: 40 }} />
      </View>
    </Screen>
  );
}

function PlanCard({
  active,
  onPress,
  label,
  price,
  unit,
  badge,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  price: string;
  unit: string;
  badge?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl p-4 border ${
        active ? 'bg-accent/10 border-accent' : 'bg-bg-raised border-border'
      }`}
      style={
        active
          ? {
              shadowColor: '#FF4D2E',
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }
          : undefined
      }
      accessibilityRole="button"
    >
      {badge ? (
        <View className="self-start bg-accent rounded-full px-2 py-0.5 mb-2">
          <Text className="text-white text-[9px] font-extrabold tracking-wider uppercase">
            {badge}
          </Text>
        </View>
      ) : null}
      <Text
        className={`${
          active ? 'text-accent' : 'text-ink-muted'
        } text-[10px] font-bold uppercase tracking-widest`}
      >
        {label}
      </Text>
      <Text className="text-ink text-2xl font-extrabold mt-1">{price}</Text>
      <Text className="text-ink-muted text-[11px] mt-0.5">{unit}</Text>
    </Pressable>
  );
}
