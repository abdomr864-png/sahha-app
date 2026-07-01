import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@features/shared';
import { LEVEL_COLOR } from '../config/levels';
import { LIFTS } from '../config/lifts';
import { formatWeight, formatWeightDelta, type WeightUnit } from '../lib/format';
import type { LiftView } from '../hooks/useStrength';

const monoFamily = 'SpaceGrotesk_700Bold';

/**
 * One lift row: current level, estimated 1RM, and a progress bar toward the
 * next tier annotated with the exact extra weight required.
 */
export function LiftLevelCard({
  lift,
  unit,
  canClassify,
}: {
  lift: LiftView;
  unit: WeightUnit;
  canClassify: boolean;
}) {
  const { t } = useTranslation();
  const liftName = t(`strength.lifts.${lift.liftId}`);
  const icon = LIFTS[lift.liftId].icon;

  if (!lift.hasData) {
    return (
      <View
        className="rounded-3xl mb-2.5"
        style={{
          backgroundColor: '#14141C',
          borderWidth: 1,
          borderColor: '#21212B',
          padding: 16,
          opacity: 0.7,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
            <LiftIcon icon={icon} color="#74748A" />
            <Text className="text-ink-subtle text-base font-bold">{liftName}</Text>
          </View>
          <Text className="text-ink-muted text-xs font-bold">{t('strength.liftCard.noData')}</Text>
        </View>
      </View>
    );
  }

  const color = lift.level ? LEVEL_COLOR[lift.level] : '#74748A';
  const fraction = lift.progress?.fraction ?? 0;
  const remaining = lift.progress?.remainingKg ?? null;
  const next = lift.progress?.next ?? null;

  return (
    <View
      className="rounded-3xl mb-2.5"
      style={{ backgroundColor: '#14141C', borderWidth: 1, borderColor: '#21212B', padding: 16 }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1" style={{ gap: 10 }}>
          <LiftIcon icon={icon} color={color} />
          <View className="flex-1">
            <Text className="text-ink text-base font-extrabold tracking-tight" numberOfLines={1}>
              {liftName}
            </Text>
            <Text className="text-ink-muted text-[11px] font-bold">
              {t('strength.liftCard.bestSet', {
                weight: formatWeight(lift.bestWeightKg, unit),
                unit,
                reps: lift.bestReps,
              })}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text
            className="text-ink font-extrabold"
            style={{
              fontSize: 18,
              lineHeight: 20,
              fontFamily: monoFamily,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatWeight(lift.estOneRmKg, unit)}
            <Text className="text-ink-muted text-xs font-bold"> {unit}</Text>
          </Text>
          <Text
            className="text-ink-muted text-[10px] font-bold uppercase"
            style={{ letterSpacing: 0.6 }}
          >
            {t('strength.liftCard.est1rm')}
          </Text>
        </View>
      </View>

      {canClassify && lift.level ? (
        <>
          <View className="flex-row items-center justify-between mb-1.5">
            <View
              className="self-start rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: `${color}1F`, borderWidth: 1, borderColor: `${color}44` }}
            >
              <Text
                className="text-[10px] font-extrabold uppercase"
                style={{ color, letterSpacing: 0.8 }}
              >
                {t(`strength.level.${lift.level}`)}
              </Text>
            </View>
            <Text className="text-ink-muted text-[11px] font-bold">
              {next && remaining !== null
                ? t('strength.liftCard.nextLevel', {
                    remaining: formatWeightDelta(remaining, unit),
                    unit,
                    level: t(`strength.level.${next}`),
                  })
                : t('strength.liftCard.maxLevel')}
            </Text>
          </View>
          <View
            className="rounded-full overflow-hidden"
            style={{ height: 7, backgroundColor: '#23232F' }}
          >
            <View style={{ width: `${Math.round(fraction * 100)}%`, height: '100%' }}>
              <LinearGradient
                colors={[`${color}AA`, color] as unknown as readonly [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </>
      ) : (
        <Text className="text-ink-muted text-[11px] font-medium">
          {t('strength.liftCard.needsProfileInline')}
        </Text>
      )}
    </View>
  );
}

function LiftIcon({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View
      className="items-center justify-center rounded-2xl"
      style={{
        width: 38,
        height: 38,
        backgroundColor: `${color}18`,
        borderWidth: 1,
        borderColor: `${color}33`,
      }}
    >
      <Icon name={icon} size={18} color={color} />
    </View>
  );
}
