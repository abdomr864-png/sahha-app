import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Icon } from '@features/shared';
import { STRENGTH_LEVELS, LEVEL_COLOR, levelIndex } from '../config/levels';
import type { CompositeResult } from '../lib/composite';

const monoFamily = 'SpaceGrotesk_700Bold';

/**
 * Headline card: the overall composite level, its 0–100 score, and a 5-segment
 * tier rail filled up to the current level.
 */
export function CompositeHeader({
  composite,
  canClassify,
}: {
  composite: CompositeResult;
  canClassify: boolean;
}) {
  const { t } = useTranslation();
  const color = LEVEL_COLOR[composite.level];
  const idx = levelIndex(composite.level);
  const showScore = canClassify && composite.liftsCounted > 0;

  return (
    <View
      className="rounded-3xl overflow-hidden mb-4"
      style={{ backgroundColor: '#14141C', borderWidth: 1, borderColor: `${color}55` }}
    >
      <View style={{ height: 2, flexDirection: 'row' }}>
        <View style={{ flex: 1 }} />
        <View style={{ flex: 2, backgroundColor: `${color}88` }} />
        <View style={{ flex: 1 }} />
      </View>
      <View style={{ padding: 20 }}>
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-ink-muted text-[11px] font-extrabold uppercase"
            style={{ letterSpacing: 1.4 }}
          >
            {t('strength.kicker')}
          </Text>
          <View
            className="items-center justify-center rounded-2xl"
            style={{
              width: 34,
              height: 34,
              backgroundColor: `${color}1F`,
              borderWidth: 1,
              borderColor: `${color}44`,
            }}
          >
            <Icon name="medal" size={18} color={color} />
          </View>
        </View>

        <View className="flex-row items-end justify-between mb-4">
          <View className="flex-1 pr-3">
            <Text
              className="font-extrabold tracking-tight"
              style={{ color, fontSize: 30, lineHeight: 34 }}
              numberOfLines={1}
            >
              {showScore ? t(`strength.level.${composite.level}`) : '—'}
            </Text>
            <Text className="text-ink-muted text-[13px] mt-1">
              {showScore
                ? t('strength.composite.subtitle', { count: composite.liftsCounted })
                : t('strength.composite.locked')}
            </Text>
          </View>
          {showScore ? (
            <View className="items-end">
              <Text
                className="text-ink font-extrabold"
                style={{
                  fontSize: 30,
                  lineHeight: 32,
                  fontFamily: monoFamily,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {composite.scorePct}
              </Text>
              <Text className="text-ink-muted text-xs font-bold">/100</Text>
            </View>
          ) : null}
        </View>

        {/* Tier rail */}
        <View className="flex-row" style={{ gap: 5 }}>
          {STRENGTH_LEVELS.map((lvl, i) => {
            const filled = showScore && i <= idx;
            const segColor = LEVEL_COLOR[lvl];
            return (
              <View key={lvl} className="flex-1">
                <View
                  className="rounded-full overflow-hidden"
                  style={{ height: 6, backgroundColor: '#23232F' }}
                >
                  {filled ? (
                    <LinearGradient
                      colors={[`${segColor}AA`, segColor] as unknown as readonly [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                </View>
                <Text
                  className="text-[8px] font-bold text-center mt-1.5"
                  style={{ color: filled ? segColor : '#74748A', letterSpacing: 0.2 }}
                  numberOfLines={1}
                >
                  {t(`strength.level.${lvl}`)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
