import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Header, Icon, Screen, Spinner } from '@features/shared';
import { useStrengthOverview, useUserBadges } from '../hooks/useStrength';
import { useStrengthSync } from '../hooks/useRecomputeStrength';
import { CompositeHeader } from './CompositeHeader';
import { LiftLevelCard } from './LiftLevelCard';
import { BadgeGallery } from './BadgeGallery';

type Tab = 'levels' | 'badges';

export function StrengthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Allow deep-linking straight to a tab, e.g. /strength?tab=badges.
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'badges' ? 'badges' : 'levels');

  // Recompute estimates + badges whenever this screen gains focus.
  useStrengthSync();

  const overview = useStrengthOverview();
  const badges = useUserBadges();

  const showEmpty = !overview.isLoading && !overview.hasAnyData;

  return (
    <Screen scroll>
      <Header title={t('strength.title')} subtitle={t('strength.subtitle')} showBack />

      {overview.isLoading && !overview.hasAnyData ? (
        <View className="py-16">
          <Spinner />
        </View>
      ) : showEmpty ? (
        <>
          <EmptyState />
          {/* Even before any data, show the full badge set (all locked, in
              order) so new users can see what's there to earn. */}
          <View className="mt-6">
            <BadgeGallery earned={badges.data ?? []} />
          </View>
        </>
      ) : (
        <>
          <CompositeHeader composite={overview.composite} canClassify={overview.canClassify} />

          {!overview.canClassify ? (
            <NeedsProfileBanner
              needsBodyweight={overview.needsBodyweight}
              needsSex={overview.needsSex}
              onPress={() => router.push('/edit-profile')}
            />
          ) : null}

          <SegmentedTabs tab={tab} onChange={setTab} earnedCount={badges.data?.length ?? 0} />

          {tab === 'levels' ? (
            <View className="mt-3">
              {overview.lifts.map((lift) => (
                <LiftLevelCard
                  key={lift.liftId}
                  lift={lift}
                  unit={overview.weightUnit}
                  canClassify={overview.canClassify}
                />
              ))}
              <Disclaimer />
            </View>
          ) : (
            <View className="mt-4">
              <BadgeGallery earned={badges.data ?? []} />
            </View>
          )}
        </>
      )}

      <View style={{ height: 60 }} />
    </Screen>
  );
}

function SegmentedTabs({
  tab,
  onChange,
  earnedCount,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  earnedCount: number;
}) {
  const { t } = useTranslation();
  return (
    <View
      className="flex-row rounded-2xl mt-4 p-1"
      style={{ backgroundColor: '#14141C', borderWidth: 1, borderColor: '#21212B' }}
    >
      <SegBtn
        label={t('strength.tabs.levels')}
        active={tab === 'levels'}
        onPress={() => onChange('levels')}
      />
      <SegBtn
        label={`${t('strength.tabs.badges')}${earnedCount > 0 ? `  ${earnedCount}` : ''}`}
        active={tab === 'badges'}
        onPress={() => onChange('badges')}
      />
    </View>
  );
}

function SegBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 items-center rounded-xl py-2.5"
      style={{ backgroundColor: active ? '#23232F' : 'transparent' }}
    >
      <Text
        className="text-[13px] font-extrabold"
        style={{ color: active ? '#F4F4F7' : '#74748A', letterSpacing: 0.3 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View
      className="rounded-3xl items-center px-6 py-10 mt-2"
      style={{ backgroundColor: '#14141C', borderWidth: 1, borderColor: '#21212B' }}
    >
      <View
        className="items-center justify-center rounded-3xl mb-4"
        style={{
          width: 64,
          height: 64,
          backgroundColor: 'rgba(255,77,46,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(255,77,46,0.28)',
        }}
      >
        <Icon name="dumbbell" size={28} color="#FF4D2E" />
      </View>
      <Text className="text-ink text-lg font-extrabold tracking-tight text-center">
        {t('strength.empty.title')}
      </Text>
      <Text className="text-ink-subtle text-[13px] text-center mt-2" style={{ lineHeight: 19 }}>
        {t('strength.empty.body')}
      </Text>
    </View>
  );
}

function NeedsProfileBanner({
  needsBodyweight,
  needsSex,
  onPress,
}: {
  needsBodyweight: boolean;
  needsSex: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const body =
    needsBodyweight && needsSex
      ? t('strength.needsProfile.bodyBoth')
      : needsBodyweight
        ? t('strength.needsProfile.bodyWeight')
        : t('strength.needsProfile.bodySex');
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl flex-row items-center mb-3 px-4 py-3.5"
      style={{
        backgroundColor: 'rgba(245,196,81,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(245,196,81,0.30)',
      }}
    >
      <Icon name="alert" size={18} color="#F5C451" />
      <View className="flex-1 mx-3">
        <Text className="text-ink text-[13px] font-bold">{t('strength.needsProfile.title')}</Text>
        <Text className="text-ink-muted text-[11px] mt-0.5">{body}</Text>
      </View>
      <Icon name="chevron-right" size={18} color="#74748A" />
    </Pressable>
  );
}

function Disclaimer() {
  const { t } = useTranslation();
  return (
    <Text className="text-ink-muted text-[10px] text-center mt-3 px-4" style={{ lineHeight: 14 }}>
      {t('strength.disclaimer')}
    </Text>
  );
}
