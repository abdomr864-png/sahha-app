/* eslint-disable max-lines */
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
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

const GOAL_COLORS: Record<string, { from: string; to: string; icon: IconName }> = {
  hypertrophy: { from: '#EF4444', to: '#FB7185', icon: 'flame' },
  strength: { from: '#3B82F6', to: '#60A5FA', icon: 'zap' },
  recomp: { from: '#10B981', to: '#34D399', icon: 'target' },
};
const FALLBACK = { from: '#52525B', to: '#71717A', icon: 'dumbbell' as IconName };
const colorForGoal = (g?: string | null) => (g && GOAL_COLORS[g.toLowerCase()]) || FALLBACK;

export function RoutinesHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const routines = useSavedRoutines(session?.user?.id);

  const items = routines.data ?? [];
  const totalProgs = items.filter((r) => !r.is_template).length;
  const totalTemps = items.filter((r) => r.is_template).length;
  const activeProgram = items.find((r) => !r.is_template);

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-4">
        <Header title={t('routines.title', 'Routines')} showBack />
      </View>

      <View className="px-5">
        {/* Hero stat strip */}
        <View
          className="rounded-3xl overflow-hidden mb-5"
          style={{
            shadowColor: '#F97316',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 22,
          }}
        >
          <LinearGradient
            colors={
              ['#1E1B4B', '#7C2D12', '#F97316'] as unknown as readonly [string, string, ...string[]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 18 }}
          >
            <LinearGradient
              colors={
                ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as unknown as readonly [
                  string,
                  string,
                  ...string[],
                ]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '60%',
              }}
            />
            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: '#FFFFFF',
                }}
              />
              <Text
                className="text-white text-[10px] font-extrabold uppercase"
                style={{ letterSpacing: 1.2, opacity: 0.9 }}
              >
                {t('routines.yourTraining')}
              </Text>
            </View>
            <Text
              className="text-white font-extrabold tracking-tight"
              style={{ fontSize: 22, lineHeight: 26 }}
            >
              {totalProgs > 0
                ? t('routines.heroActive', 'Programs ready when you are')
                : t('routines.heroEmpty', 'Build your first plan')}
            </Text>
            <View className="flex-row mt-4" style={{ gap: 8 }}>
              <HeroStat label={t('routines.programs', 'Programs')} value={String(totalProgs)} />
              <HeroStat label={t('routines.templates', 'Templates')} value={String(totalTemps)} />
              <HeroStat
                label={t('routines.aiCount', 'AI plans')}
                value={String(items.filter((r) => r.is_ai_generated).length)}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Quick actions */}
        <Text
          className="text-ink-muted text-[10px] font-extrabold uppercase mb-3"
          style={{ letterSpacing: 1.2 }}
        >
          {t('routines.quickActions', 'Quick actions')}
        </Text>
        <View className="flex-row mb-6" style={{ gap: 10 }}>
          <ActionTile
            icon="clock"
            title={t('routines.todayCard', "Today's workout")}
            subtitle={t('routines.todayHint', 'Quick · ~5 sec')}
            gradient={['#7C3AED', '#A855F7']}
            onPress={() => router.push('/routines/generate-workout')}
          />
          <ActionTile
            icon={activeProgram ? 'play' : 'calendar'}
            title={
              activeProgram
                ? t('routines.continueCard', 'Continue program')
                : t('routines.programCard', 'Full program')
            }
            subtitle={
              activeProgram
                ? t('routines.continueHint', 'Pick today’s session')
                : t('routines.programHint', '4–12 weeks')
            }
            gradient={activeProgram ? ['#064E3B', '#10B981'] : ['#0F766E', '#14B8A6']}
            onPress={() =>
              router.push(
                activeProgram ? (`/routines/program/${activeProgram.id}` as never) : '/program-gen',
              )
            }
          />
        </View>

        {/* My routines */}
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-ink-muted text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {t('routines.myRoutines', 'My routines')}
          </Text>
          {items.length > 0 ? (
            <Text className="text-ink-muted text-[11px] font-bold">{items.length}</Text>
          ) : null}
        </View>

        {items.length === 0 ? (
          <View
            className="rounded-3xl items-center"
            style={{
              backgroundColor: '#17171B',
              borderWidth: 1,
              borderColor: '#27272F',
              padding: 28,
            }}
          >
            <View
              className="rounded-3xl items-center justify-center mb-3"
              style={{
                width: 56,
                height: 56,
                backgroundColor: 'rgba(249,115,22,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(249,115,22,0.25)',
              }}
            >
              <Icon name="dumbbell" size={26} color="#F97316" />
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
              <RoutineCard
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="rounded-xl"
      style={{
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
      }}
    >
      <Text
        className="text-white font-extrabold tracking-tight"
        style={{ fontSize: 18, lineHeight: 20 }}
      >
        {value}
      </Text>
      <Text
        className="text-white/75 text-[9px] font-bold uppercase mt-0.5"
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
  subtitle,
  gradient,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  gradient: string[];
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 20, stiffness: 400 }))}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            borderRadius: 18,
            overflow: 'hidden',
            shadowColor: gradient[0],
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 14,
          },
        ]}
      >
        <LinearGradient
          colors={gradient as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 14, minHeight: 110 }}
        >
          <LinearGradient
            colors={
              ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as unknown as readonly [
                string,
                string,
                ...string[],
              ]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '55%',
            }}
          />
          <View
            className="rounded-xl items-center justify-center mb-3"
            style={{
              width: 38,
              height: 38,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
            }}
          >
            <Icon name={icon} size={18} color="#FFFFFF" />
          </View>
          <Text
            className="text-white font-extrabold tracking-tight"
            style={{ fontSize: 14, lineHeight: 17 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text className="text-white/85 text-[11px] mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function RoutineCard({ routine, onPress }: { routine: SavedRoutineRow; onPress: () => void }) {
  const { t } = useTranslation();
  const c = colorForGoal(routine.goal);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.99, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 20, stiffness: 400 }))}
    >
      <Animated.View
        className="rounded-2xl overflow-hidden mb-2.5"
        style={[
          animatedStyle,
          {
            backgroundColor: '#17171B',
            borderWidth: 1,
            borderColor: '#27272F',
          },
        ]}
      >
        <LinearGradient
          colors={
            ['transparent', `${c.from}80`, 'transparent'] as unknown as readonly [
              string,
              string,
              ...string[],
            ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 1 }}
        />

        <View className="flex-row items-center p-3">
          <LinearGradient
            colors={[c.from, c.to] as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              shadowColor: c.from,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
            }}
          >
            <Icon name={routine.is_template ? 'bookmark' : c.icon} size={20} color="#FFFFFF" />
          </LinearGradient>

          <View className="flex-1">
            <View className="flex-row items-center mb-0.5" style={{ gap: 6 }}>
              {routine.goal ? (
                <Text
                  className="text-[9px] font-extrabold uppercase"
                  style={{ color: c.from, letterSpacing: 1 }}
                  numberOfLines={1}
                >
                  {routine.goal}
                </Text>
              ) : null}
              {routine.is_ai_generated ? (
                <View
                  className="rounded-full px-1.5"
                  style={{
                    paddingVertical: 1,
                    backgroundColor: 'rgba(249,115,22,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(249,115,22,0.3)',
                  }}
                >
                  <Text
                    className="text-[8px] font-extrabold uppercase"
                    style={{ color: '#F97316', letterSpacing: 0.6 }}
                  >
                    {t('routines.aiBadge')}
                  </Text>
                </View>
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

          <View
            className="rounded-full items-center justify-center ml-2"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: `${c.from}1A`,
              borderWidth: 1,
              borderColor: `${c.from}30`,
            }}
          >
            <Icon name="chevron-right" size={13} color={c.from} />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
