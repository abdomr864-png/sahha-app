import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Icon } from '@features/shared';
import { ALL_BADGES, type BadgeDef } from '../config/badges';
import type { UserBadgeRow } from '../schemas';
import { BadgeEmblem } from './BadgeEmblem';

interface BadgeText {
  title: string;
  description: string;
}

export function badgeText(badge: BadgeDef, t: TFunction): BadgeText {
  if (badge.kind === 'level') {
    return {
      title: t('strength.badges.levelTitle', {
        level: t(`strength.level.${badge.level}`),
        lift: t(`strength.lifts.${badge.liftId}`),
      }),
      description: t('strength.badges.levelDesc', {
        lift: t(`strength.lifts.${badge.liftId}`),
        level: t(`strength.level.${badge.level}`),
      }),
    };
  }
  return {
    title: t(`strength.badges.milestone.${badge.i18nKey}.title`),
    description: t(`strength.badges.milestone.${badge.i18nKey}.desc`),
  };
}

/** Earned-vs-locked gallery over every defined badge. */
export function BadgeGallery({ earned }: { earned: readonly UserBadgeRow[] }) {
  const { t } = useTranslation();
  const earnedIds = useMemo(() => new Set(earned.map((b) => b.badge_id)), [earned]);

  const { earnedBadges, lockedBadges } = useMemo(() => {
    const e: BadgeDef[] = [];
    const l: BadgeDef[] = [];
    for (const b of ALL_BADGES) (earnedIds.has(b.id) ? e : l).push(b);
    return { earnedBadges: e, lockedBadges: l };
  }, [earnedIds]);

  return (
    <View>
      <View className="flex-row items-center justify-between mb-3">
        <Text
          className="text-ink-muted text-[11px] font-extrabold uppercase"
          style={{ letterSpacing: 1.2 }}
        >
          {t('strength.badges.earned')}
        </Text>
        <Text
          className="text-ink text-[11px] font-extrabold"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {t('strength.badges.count', { earned: earnedBadges.length, total: ALL_BADGES.length })}
        </Text>
      </View>

      {earnedBadges.length === 0 ? (
        <Text className="text-ink-muted text-[13px] mb-5" style={{ lineHeight: 18 }}>
          {t('strength.badges.noneEarned')}
        </Text>
      ) : (
        <BadgeGrid badges={earnedBadges} earned t={t} />
      )}

      <Text
        className="text-ink-muted text-[11px] font-extrabold uppercase mb-3 mt-4"
        style={{ letterSpacing: 1.2 }}
      >
        {t('strength.badges.locked')}
      </Text>
      <BadgeGrid badges={lockedBadges} earned={false} t={t} />
    </View>
  );
}

function BadgeGrid({
  badges,
  earned,
  t,
}: {
  badges: readonly BadgeDef[];
  earned: boolean;
  t: TFunction;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {badges.map((badge) => (
        <BadgeTile key={badge.id} badge={badge} earned={earned} t={t} />
      ))}
    </View>
  );
}

function BadgeTile({ badge, earned, t }: { badge: BadgeDef; earned: boolean; t: TFunction }) {
  const text = badgeText(badge, t);

  return (
    <View
      className="rounded-2xl items-center"
      style={{
        width: '31.5%',
        paddingVertical: 14,
        paddingHorizontal: 8,
        backgroundColor: earned ? '#14141C' : '#101017',
        borderWidth: 1,
        borderColor: earned ? 'rgba(255,255,255,0.07)' : '#1C1C26',
        opacity: earned ? 1 : 0.86,
      }}
    >
      <View className="mb-2" style={{ width: 60, height: 60 }}>
        <BadgeEmblem badge={badge} size={60} locked={!earned} />
        {!earned ? (
          <View
            className="absolute items-center justify-center rounded-full"
            style={{
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              backgroundColor: '#1A1A22',
              borderWidth: 1.5,
              borderColor: '#0A0A0F',
            }}
          >
            <Icon name="lock" size={10} color="#8A8A99" />
          </View>
        ) : null}
      </View>
      <Text
        className="text-center text-[11px] font-extrabold"
        style={{ color: earned ? '#F4F4F7' : '#74748A', lineHeight: 13 }}
        numberOfLines={2}
      >
        {text.title}
      </Text>
      <Text
        className="text-center text-ink-muted text-[9px] mt-1"
        numberOfLines={2}
        style={{ lineHeight: 11 }}
      >
        {text.description}
      </Text>
    </View>
  );
}
