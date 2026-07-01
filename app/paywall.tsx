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
import { usePlans, useSubscription } from '@features/premium';

type TierId = string;

interface Tier {
  id: TierId;
  /** i18n key suffix under premium.paywall.tiers.<id> */
  name: string;
  price: string;
  /** Billing cadence line (e.g. "/ year", "one-time"). */
  unit: string;
  /** Optional secondary line, e.g. monthly-equivalent or trial note. */
  sub?: string;
  /** Optional ribbon, e.g. "Most popular". */
  badge?: string;
  highlight?: boolean;
  /** Feature bullets (already-translated strings). */
  features: string[];
}

export default function Paywall() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const sub = useSubscription();
  const plans = usePlans();

  const isPremium = sub.data?.isPremium ?? false;
  const expiresAt = sub.data?.expires_at;

  // Hard-coded fallback — used offline or before the admin-managed `plans`
  // table is seeded. When live plans exist, they override price/copy/order.
  const fallbackTiers: Tier[] = [
    {
      id: 'pro',
      name: t('premium.paywall.tiers.pro.name', 'Pro'),
      price: '$71.99',
      unit: t('premium.paywall.perYear', '/ year'),
      sub: t('premium.paywall.tiers.pro.sub', 'or $11.99 / mo · 7-day trial'),
      features: [
        t('premium.paywall.tiers.pro.f1', 'Full recovery: HRV + ACWR'),
        t('premium.paywall.tiers.pro.f2', 'Strength levels & badges'),
        t('premium.paywall.tiers.pro.f3', 'Apple Watch app'),
        t('premium.paywall.tiers.pro.f4', 'Unlimited history + analytics'),
      ],
    },
    {
      id: 'elite',
      name: t('premium.paywall.tiers.elite.name', 'Elite'),
      price: '$119.99',
      unit: t('premium.paywall.perYear', '/ year'),
      sub: t('premium.paywall.tiers.elite.sub', 'or $19.99 / mo · 7-day trial'),
      badge: t('premium.paywall.tiers.elite.badge', 'Most popular'),
      highlight: true,
      features: [
        t('premium.paywall.tiers.elite.f1', 'Everything in Pro'),
        t('premium.paywall.tiers.elite.f2', 'Unlimited AI coach & chat'),
        t('premium.paywall.tiers.elite.f3', 'Equipment scan, form check & meal AI'),
        t('premium.paywall.tiers.elite.f4', 'Adaptive AI programs'),
      ],
    },
    {
      id: 'lifetime',
      name: t('premium.paywall.tiers.lifetime.name', 'Lifetime'),
      price: '$199.99',
      unit: t('premium.paywall.oneTime', 'one-time'),
      sub: t('premium.paywall.tiers.lifetime.sub', 'Pay once · keep forever'),
      features: [
        t('premium.paywall.tiers.lifetime.f1', 'Everything in Elite, forever'),
        t('premium.paywall.tiers.lifetime.f2', 'AI fair-use included'),
        t('premium.paywall.tiers.lifetime.f3', 'All future updates'),
      ],
    },
  ];

  const fmtPrice = (price: number, currency: string) =>
    currency === 'USD' || !currency ? `$${price}` : `${price} ${currency}`;
  const fmtUnit = (interval: string) =>
    interval === 'one_time'
      ? t('premium.paywall.oneTime', 'one-time')
      : interval === 'month'
        ? t('premium.paywall.perMonth', '/ mo')
        : t('premium.paywall.perYear', '/ year');

  const liveTiers: Tier[] = (plans.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: fmtPrice(p.price, p.currency),
    unit: fmtUnit(p.billing_interval),
    sub: p.description ?? undefined,
    badge: p.badge ?? undefined,
    highlight: p.highlight,
    features: p.features ?? [],
  }));

  const tiers: Tier[] = liveTiers.length > 0 ? liveTiers : fallbackTiers;
  const [selected, setSelected] = useState<TierId>('elite');
  const selectedId = tiers.some((tr) => tr.id === selected) ? selected : tiers[0]?.id;

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
              <Icon name="check-circle" size={14} color="#2EE6A6" />
              <Text className="text-success ml-1.5 text-xs font-bold tracking-wider uppercase">
                {sub.data?.status === 'trialing'
                  ? t('premium.paywall.trialing')
                  : t('premium.paywall.active')}
              </Text>
            </View>
          ) : null}
        </View>

        {!isPremium ? (
          <>
            {/* Tier cards */}
            <View style={{ gap: 12 }} className="mb-6">
              {tiers.map((tier) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  active={selectedId === tier.id}
                  onPress={() => setSelected(tier.id)}
                />
              ))}
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
                <Icon name="calendar" size={16} color="#B4B4C2" />
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

function TierCard({ tier, active, onPress }: { tier: Tier; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`rounded-2xl p-4 border ${
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
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text
              className={`${
                active ? 'text-accent' : 'text-ink'
              } text-lg font-extrabold tracking-tight`}
            >
              {tier.name}
            </Text>
            {tier.badge ? (
              <View className="ml-2 bg-accent rounded-full px-2 py-0.5">
                <Text className="text-white text-[9px] font-extrabold tracking-wider uppercase">
                  {tier.badge}
                </Text>
              </View>
            ) : null}
          </View>
          {tier.sub ? <Text className="text-ink-muted text-[11px] mt-0.5">{tier.sub}</Text> : null}
        </View>
        <View className="items-end">
          <Text className="text-ink text-2xl font-extrabold">{tier.price}</Text>
          <Text className="text-ink-muted text-[11px]">{tier.unit}</Text>
        </View>
      </View>

      <View style={{ gap: 8 }} className="mt-1">
        {tier.features.map((f, i) => (
          <FeatureRow key={i} label={f} icon={tier.highlight ? 'sparkles' : 'check'} />
        ))}
      </View>
    </Pressable>
  );
}

function FeatureRow({ label, icon }: { label: string; icon: IconName }) {
  return (
    <View className="flex-row items-center">
      <Icon name={icon} size={14} color="#2EE6A6" strokeWidth={2.4} />
      <Text className="text-ink text-sm ml-2 flex-1">{label}</Text>
    </View>
  );
}
