import { useEffect, useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Icon } from '@features/shared';
import { LEVEL_COLOR } from '../config/levels';
import { getBadge, levelBadgeId, type BadgeDef } from '../config/badges';
import { useCelebrationStore, type Celebration } from '../store';
import { badgeText } from './BadgeGallery';
import { BadgeEmblem } from './BadgeEmblem';

const DISPLAY_MS = 2400;
const RAYS = 8;

interface Resolved {
  color: string;
  icon: Parameters<typeof Icon>[0]['name'];
  heading: string;
  body: string;
  /** The badge whose emblem to show in the burst (level-ups map to their level badge). */
  badge: BadgeDef | null;
}

/**
 * Plays queued celebrations (level-ups + new badges) one at a time as a
 * full-screen reanimated burst. Mount once near the app root (or on the
 * Strength screen). Self-advances through the queue; tap to skip.
 */
export function LevelUpCelebration() {
  const current = useCelebrationStore((s) => s.queue[0] ?? null);
  const shift = useCelebrationStore((s) => s.shift);

  // A stable key per celebration so animations retrigger on advance.
  const key = current ? celebrationKey(current) : null;

  return <CelebrationOverlay celebration={current} celebrationKey={key} onDone={shift} />;
}

function celebrationKey(c: Celebration): string {
  return c.kind === 'level' ? `level:${c.liftId}:${c.level}` : `badge:${c.badgeId}`;
}

function CelebrationOverlay({
  celebration,
  celebrationKey: key,
  onDone,
}: {
  celebration: Celebration | null;
  celebrationKey: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();

  const backdrop = useSharedValue(0);
  const pop = useSharedValue(0);
  const rays = useSharedValue(0);
  const ring = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!key) return;
    backdrop.value = withTiming(1, { duration: 180 });
    pop.value = withSequence(
      withTiming(1.12, { duration: 320, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.cubic) }),
    );
    rays.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    ring.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );

    timer.current = setTimeout(onDone, DISPLAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(rays);
      cancelAnimation(ring);
      backdrop.value = 0;
      pop.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const popStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
    transform: [{ scale: 0.6 + pop.value * 0.4 }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rays.value * 360}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{ scale: 0.8 + ring.value * 1.4 }],
  }));

  if (!celebration || !key) return null;
  const r = resolve(celebration, t);

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onDone}>
      <Pressable onPress={onDone} className="flex-1">
        <Animated.View
          className="flex-1 items-center justify-center"
          style={[{ backgroundColor: 'rgba(8,8,12,0.86)' }, backdropStyle]}
        >
          <Animated.View className="items-center" style={popStyle}>
            {/* Rotating rays */}
            <View className="items-center justify-center" style={{ width: 220, height: 220 }}>
              <Animated.View style={[{ position: 'absolute', width: 220, height: 220 }, raysStyle]}>
                {Array.from({ length: RAYS }).map((_, i) => (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      left: 108,
                      top: 8,
                      width: 4,
                      height: 40,
                      borderRadius: 2,
                      backgroundColor: `${r.color}66`,
                      transform: [{ translateX: 0 }, { rotate: `${(360 / RAYS) * i}deg` }],
                      transformOrigin: '2px 102px',
                    }}
                  />
                ))}
              </Animated.View>

              {/* Expanding ring */}
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    borderWidth: 3,
                    borderColor: r.color,
                  },
                  ringStyle,
                ]}
              />

              {/* Emblem medallion */}
              {r.badge ? (
                <BadgeEmblem badge={r.badge} size={132} />
              ) : (
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 116,
                    height: 116,
                    backgroundColor: `${r.color}1F`,
                    borderWidth: 2,
                    borderColor: `${r.color}66`,
                  }}
                >
                  <Icon name={r.icon} size={52} color={r.color} />
                </View>
              )}
            </View>

            <Text
              className="font-extrabold uppercase mt-6 text-center"
              style={{ color: r.color, letterSpacing: 2, fontSize: 13 }}
            >
              {r.heading}
            </Text>
            <Text className="text-ink text-2xl font-extrabold tracking-tight text-center mt-1.5 px-8">
              {r.body}
            </Text>
            <Text className="text-ink-muted text-xs mt-4">
              {t('strength.celebrate.tapToContinue')}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function resolve(c: Celebration, t: ReturnType<typeof useTranslation>['t']): Resolved {
  if (c.kind === 'level') {
    return {
      color: LEVEL_COLOR[c.level],
      icon: 'medal',
      heading: t('strength.celebrate.levelUp'),
      body: t('strength.celebrate.levelUpBody', {
        lift: t(`strength.lifts.${c.liftId}`),
        level: t(`strength.level.${c.level}`),
      }),
      badge: getBadge(levelBadgeId(c.liftId, c.level)) ?? null,
    };
  }
  const badge = getBadge(c.badgeId) ?? null;
  const color = badge?.kind === 'level' ? LEVEL_COLOR[badge.level] : '#FF8A2B';
  const body = badge ? badgeText(badge, t).title : c.badgeId;
  return {
    color,
    icon: badge?.icon ?? 'medal',
    heading: t('strength.celebrate.badge'),
    body,
    badge,
  };
}
