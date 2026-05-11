import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Header, Icon, Screen } from '@features/shared';
import type { IconName } from '@features/shared';
import { useSession } from '@features/auth';
import { useSavedRoutines, type SavedRoutineRow } from '../hooks/useSavedRoutines';

const GOAL_ACCENT: Record<string, IconName> = {
  hypertrophy: 'flame',
  strength: 'zap',
  recomp: 'target',
};
const iconForGoal = (g?: string | null): IconName =>
  (g && GOAL_ACCENT[g.toLowerCase()]) || 'dumbbell';

export function RoutinesHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const routines = useSavedRoutines(session?.user?.id);

  const items = routines.data ?? [];
  const totalProgs = items.filter((r) => !r.is_template).length;
  const totalTemps = items.filter((r) => r.is_template).length;
  const totalAI = items.filter((r) => r.is_ai_generated).length;
  const activeProgram = items.find((r) => !r.is_template);

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-4">
        <Header title={t('routines.title', 'Routines')} showBack />
      </View>

      <View className="px-5">
        {/* Hero stat strip — calm, single surface */}
        <View
          className="rounded-3xl mb-7"
          style={{
            backgroundColor: '#13131A',
            borderWidth: 1,
            borderColor: '#27272F',
            padding: 18,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: 4,
              backgroundColor: '#FF4D2E',
              borderTopLeftRadius: 24,
              borderBottomLeftRadius: 24,
            }}
          />
          <Text
            className="text-accent text-[10px] font-extrabold uppercase mb-2"
            style={{ letterSpacing: 1.4 }}
          >
            {t('routines.yourTraining', 'Your training')}
          </Text>
          <Text
            className="text-ink font-extrabold tracking-tight mb-4"
            style={{ fontSize: 22, lineHeight: 26 }}
          >
            {totalProgs > 0
              ? t('routines.heroActive', 'Programs ready when you are')
              : t('routines.heroEmpty', 'Build your first plan')}
          </Text>
          <View className="flex-row" style={{ gap: 10 }}>
            <HeroStat label={t('routines.programs', 'Programs')} value={String(totalProgs)} />
            <HeroStat label={t('routines.templates', 'Templates')} value={String(totalTemps)} />
            <HeroStat label={t('routines.aiCount', 'AI plans')} value={String(totalAI)} />
          </View>
        </View>

        {/* Quick actions — Leap-style 2-tile grid */}
        <SectionLabel>{t('routines.quickActions', 'Quick actions')}</SectionLabel>
        <View className="flex-row mb-7" style={{ gap: 12 }}>
          <ActionTile
            icon="clock"
            title={t('routines.todayCard', "Today's workout")}
            sub={t('routines.todayHint', 'Quick · ~5 sec')}
            onPress={() => router.push('/routines/generate-workout')}
          />
          <ActionTile
            icon={activeProgram ? 'play' : 'calendar'}
            title={
              activeProgram
                ? t('routines.continueCard', 'Continue program')
                : t('routines.programCard', 'Full program')
            }
            sub={
              activeProgram
                ? t('routines.continueHint', 'Pick today’s session')
                : t('routines.programHint', '4–12 weeks')
            }
            onPress={() =>
              router.push(
                activeProgram ? (`/routines/program/${activeProgram.id}` as never) : '/program-gen',
              )
            }
          />
        </View>

        {/* My routines */}
        <View className="flex-row items-center justify-between mb-3">
          <SectionLabel>{t('routines.myRoutines', 'My routines')}</SectionLabel>
          {items.length > 0 ? (
            <Text className="text-ink-muted text-[11px] font-bold">{items.length}</Text>
          ) : null}
        </View>

        {items.length === 0 ? (
          <View
            className="rounded-3xl items-center"
            style={{
              backgroundColor: '#13131A',
              borderWidth: 1,
              borderColor: '#27272F',
              padding: 28,
            }}
          >
            <View
              className="rounded-2xl items-center justify-center mb-3"
              style={{
                width: 52,
                height: 52,
                backgroundColor: 'rgba(255,77,46,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255,77,46,0.25)',
              }}
            >
              <Icon name="dumbbell" size={22} color="#FF4D2E" />
            </View>
            <Text className="text-ink text-base font-extrabold tracking-tight mb-1 text-center">
              {t('routines.empty', 'No routines yet')}
            </Text>
            <Text className="text-ink-subtle text-[12px] text-center">
              {t('routines.emptyHint', 'Generate one above to get started.')}
            </Text>
          </View>
        ) : (
          items.map((r, idx) => (
            <Animated.View key={r.id} entering={FadeIn.duration(200).delay(idx * 30)}>
              <RoutineRow
                routine={r}
                onPress={() => router.push(`/routines/program/${r.id}` as never)}
              />
            </Animated.View>
          ))
        )}

        <View style={{ height: 32 }} />
      </View>
    </Screen>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      className="text-ink-muted text-[11px] font-extrabold uppercase mb-3"
      style={{ letterSpacing: 1.4 }}
    >
      {children}
    </Text>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="rounded-2xl"
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#1B1B24',
        borderWidth: 1,
        borderColor: '#27272F',
      }}
    >
      <Text className="text-ink text-xl font-extrabold tracking-tight">{value}</Text>
      <Text
        className="text-ink-muted text-[9px] font-bold uppercase mt-0.5"
        style={{ letterSpacing: 0.8 }}
      >
        {label}
      </Text>
    </View>
  );
}

function ActionTile({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 22, stiffness: 380 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 22, stiffness: 380 }))}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            backgroundColor: '#13131A',
            borderWidth: 1,
            borderColor: '#27272F',
            borderRadius: 20,
            padding: 16,
            minHeight: 108,
          },
        ]}
      >
        <View className="w-9 h-9 rounded-xl bg-bg-elevated items-center justify-center mb-3">
          <Icon name={icon} size={18} color="#FF4D2E" />
        </View>
        <Text className="text-ink text-[14px] font-extrabold tracking-tight" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-ink-subtle text-[11px] mt-0.5" numberOfLines={1}>
          {sub}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function RoutineRow({ routine, onPress }: { routine: SavedRoutineRow; onPress: () => void }) {
  const { t } = useTranslation();
  const icon = routine.is_template ? 'bookmark' : iconForGoal(routine.goal);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.99, { damping: 22, stiffness: 380 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 22, stiffness: 380 }))}
    >
      <Animated.View
        className="flex-row items-center rounded-2xl px-4 py-3 mb-2.5"
        style={[
          animatedStyle,
          {
            backgroundColor: '#13131A',
            borderWidth: 1,
            borderColor: '#27272F',
          },
        ]}
      >
        <View
          className="rounded-xl items-center justify-center mr-3"
          style={{
            width: 44,
            height: 44,
            backgroundColor: 'rgba(255,77,46,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(255,77,46,0.25)',
          }}
        >
          <Icon name={icon} size={18} color="#FF4D2E" />
        </View>

        <View className="flex-1">
          <View className="flex-row items-center mb-0.5" style={{ gap: 6 }}>
            {routine.goal ? (
              <Text
                className="text-accent text-[9px] font-extrabold uppercase"
                style={{ letterSpacing: 1 }}
                numberOfLines={1}
              >
                {routine.goal}
              </Text>
            ) : null}
            {routine.is_ai_generated ? (
              <Text
                className="text-ink-muted text-[9px] font-extrabold uppercase"
                style={{ letterSpacing: 0.8 }}
              >
                · {t('routines.aiBadge')}
              </Text>
            ) : null}
          </View>
          <Text className="text-ink text-[14px] font-extrabold tracking-tight" numberOfLines={1}>
            {routine.name}
          </Text>
          <Text className="text-ink-subtle text-[11px] mt-0.5" numberOfLines={1}>
            {routine.is_template
              ? t('routines.template')
              : t('routines.templateSummary', {
                  weeks: routine.weeks,
                  days: routine.days_per_week,
                  sessions: routine.weeks * routine.days_per_week,
                })}
          </Text>
        </View>

        <Icon name="chevron-right" size={14} color="#52525B" />
      </Animated.View>
    </Pressable>
  );
}
