/* eslint-disable max-lines -- Home bento grid: aspirational 300-line cap; refactor tracked separately. */
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { CalendarSheet, Icon, Screen } from '@features/shared';
import type { IconName } from '@features/shared';
import { useRequireAuth } from '@features/auth';
import { useWeeklyAdjustmentBanner, useHasProgram } from '@features/ai-program-adjust';
import { useTodayNutrition } from '@features/ai-meal-parse';
import { useDailyTargets } from '@features/onboarding';
import { useTodayHealth } from '@features/wearables';
import { RecoveryWeekBanner, useStreak } from '@features/streaks';

/**
 * Sahha home — Cal-AI inspired layout.
 *   1. Brand bar + streak chip
 *   2. Week strip (per-day completion rings)
 *   3. Stat pager — Nutrition / Activity / Recovery (swipe-driven)
 *   4. Page dots (active dot tracks the pager)
 *   5. "Power moves" — AI feature deck (replaces a food feed)
 */

const DAY_LABEL_KEYS = [
  'home.days.sun',
  'home.days.mon',
  'home.days.tue',
  'home.days.wed',
  'home.days.thu',
  'home.days.fri',
  'home.days.sat',
] as const;

function startOfWeekSun(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const banner = useWeeklyAdjustmentBanner();
  const hasProgram = useHasProgram();
  const nutrition = useTodayNutrition();
  const targets = useDailyTargets();
  const health = useTodayHealth();
  // Gate on the data value itself (not isFetched) so the CTA renders instantly
  // from the persisted initialData on cold launch. While data is still
  // undefined (first ever launch with no cache) we render neither, which
  // matches the prior loading behavior.
  const showStartCTA = hasProgram.data === false;
  const showContinueCTA = hasProgram.data === true;
  const requireAuth = useRequireAuth();

  // AI features need a profile to personalize. Guests can see the home
  // tab, but tapping any AI CTA prompts sign-in first.
  const aiPrompt = t('auth.gate.aiPrompt', {
    defaultValue: 'Create an account so the AI can tune training and macros to you.',
  });
  const goAI = (
    route: '/program-gen' | '/routines' | '/meal-quick-log' | '/form-check' | '/scan' | '/ai-coach',
  ) => void requireAuth(() => router.push(route as never), aiPrompt);

  const { data: streakRow } = useStreak();
  const streak = streakRow?.current_streak ?? 0;
  const kcalEaten = nutrition.data?.kcalEaten ?? 0;
  const protein = nutrition.data?.protein ?? 0;
  const carbs = nutrition.data?.carbs ?? 0;
  const fat = nutrition.data?.fat ?? 0;
  const burnedExercise = nutrition.data?.burnedExercise ?? 0;
  const burnedSteps = nutrition.data?.burnedSteps ?? 0;
  const kcalTarget = targets.data?.kcal ?? 2400;
  const proteinTarget = targets.data?.proteinG ?? 160;
  const carbsTarget = targets.data?.carbsG ?? 280;
  const fatTarget = targets.data?.fatG ?? 75;

  const today = new Date();
  const weekStart = startOfWeekSun(today);
  const todayIdx = today.getDay();
  const dayCompletion = [1, 1, 1, 1, 1, 0.55, 0]; // mock — past full, today partial, future empty

  const [calendarOpen, setCalendarOpen] = useState(false);

  const { width: winW } = useWindowDimensions();
  const PAGER_PADDING = 20; // matches px-5 on the wrapper
  const pagerW = Math.max(0, winW - PAGER_PADDING * 2);
  const [pagerIndex, setPagerIndex] = useState(0);
  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pagerW <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pagerW);
    if (i !== pagerIndex) setPagerIndex(i);
  };

  const stepsCount = health.data?.steps ?? 0;
  const workoutsCount = health.data?.workoutsCount ?? 0;
  const workoutsMinutes = health.data?.workoutsMinutes ?? 0;
  const workoutsDistanceM = health.data?.workoutsDistanceM ?? 0;
  const restingHr = health.data?.restingHr ?? null;
  const hrv = health.data?.hrv ?? null;
  const sleepMinutes = health.data?.sleepMinutes ?? null;
  const weightKg = health.data?.weightKg ?? null;

  const getDayCompletion = useCallback(
    (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      if (d > t) return 0;

      // Today and current-week days come from live (mocked) state.
      const ws = startOfWeekSun(t);
      const weekDiff = Math.round((d.getTime() - ws.getTime()) / 86_400_000);
      if (weekDiff >= 0 && weekDiff < 7) {
        return dayCompletion[weekDiff] ?? 0;
      }

      // Past days: deterministic mock until backed by real activity data.
      return mockHistoricalCompletion(d);
    },
    [dayCompletion],
  );

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-2 pb-1">
        {/* Brand bar */}
        <View className="flex-row items-center justify-between mb-5">
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            className="flex-row items-center"
          >
            <View className="w-9 h-9 rounded-2xl items-center justify-center bg-bg-raised border border-border mr-2">
              <Icon name="apple" size={18} color="#F4F4F5" />
            </View>
            <Text className="text-ink text-2xl font-extrabold tracking-tight">Sahha</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/streaks' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('streaks.openDetail', {
              defaultValue: 'Open streak details',
            })}
            className="px-3 py-1.5 rounded-full bg-bg-raised border border-border flex-row items-center"
          >
            <Icon name="flame" size={14} color="#F97316" />
            <Text className="text-ink text-base font-extrabold ml-1.5">{streak}</Text>
          </Pressable>
        </View>

        <RecoveryWeekBanner />

        {/* Week strip — tap to open the full activity calendar */}
        <Pressable
          onPress={() => setCalendarOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('home.openCalendar', {
            defaultValue: 'Open activity calendar',
          })}
          className="flex-row items-center justify-between mb-4"
        >
          {DAY_LABEL_KEYS.map((labelKey, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const isToday = i === todayIdx;
            const isFuture = i > todayIdx;
            const pct = dayCompletion[i] ?? 0;
            return (
              <View key={labelKey} className="items-center" style={{ flex: 1 }}>
                <Text
                  className={`text-[11px] font-bold mb-1.5 ${
                    isToday ? 'text-ink' : 'text-ink-muted'
                  }`}
                >
                  {t(labelKey)}
                </Text>
                <DayRing
                  value={isFuture ? 0 : pct}
                  active={isToday}
                  dim={isFuture}
                  number={d.getDate()}
                />
              </View>
            );
          })}
        </Pressable>

        {/* Stat pager — swipe between Nutrition / Activity / Recovery */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onPagerScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
          <View style={{ width: pagerW }}>
            <NutritionPage
              t={t}
              kcalEaten={kcalEaten}
              kcalTarget={kcalTarget}
              protein={protein}
              proteinTarget={proteinTarget}
              carbs={carbs}
              carbsTarget={carbsTarget}
              fat={fat}
              fatTarget={fatTarget}
              burnedExercise={burnedExercise}
              burnedSteps={burnedSteps}
            />
          </View>
          <View style={{ width: pagerW }}>
            <ActivityPage
              t={t}
              steps={stepsCount}
              workoutsCount={workoutsCount}
              workoutsMinutes={workoutsMinutes}
              workoutsDistanceM={workoutsDistanceM}
              activeKcal={burnedExercise}
              stepKcal={burnedSteps}
            />
          </View>
          <View style={{ width: pagerW }}>
            <RecoveryPage
              t={t}
              sleepMinutes={sleepMinutes}
              restingHr={restingHr}
              hrv={hrv}
              weightKg={weightKg}
            />
          </View>
        </ScrollView>

        {/* Page dots — active dot tracks the pager */}
        <View className="flex-row items-center justify-center mb-6 mt-1" style={{ gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                pagerIndex === i ? 'bg-ink' : 'bg-ink-muted/40'
              }`}
            />
          ))}
        </View>

        {/* Start CTA — shown only to users without a program */}
        {showStartCTA ? (
          <StartCTA
            title={t('home.startTitle', { defaultValue: 'Ready to start?' })}
            tagline={t('home.startTagline', {
              defaultValue: 'Build your AI program in 30 seconds',
            })}
            cta={t('home.startCta', { defaultValue: 'Get started' })}
            onPress={() => goAI('/program-gen')}
          />
        ) : null}

        {/* Continue CTA — shown when user already has a saved program */}
        {showContinueCTA ? (
          <ContinueCTA
            title={t('home.continueTitle', {
              defaultValue: 'Pick up where you left off',
            })}
            tagline={t('home.continueTagline', {
              defaultValue: 'Your program is ready — continue today’s workout',
            })}
            cta={t('home.continueCta', { defaultValue: 'Continue' })}
            onPress={() => goAI('/routines')}
          />
        ) : null}

        {/* Premium meal-snap CTA — primary food-logging entry point */}
        <MealCTA
          title={t('home.mealParseTitle', { defaultValue: 'Snap a meal' })}
          tagline={t('home.mealParseTaglinePro', {
            defaultValue: 'Photo → calories, macros, instant',
          })}
          cta={t('home.mealParseCta', { defaultValue: 'Snap a photo' })}
          onPress={() => goAI('/meal-quick-log')}
        />

        {/* Power moves — feature deck */}
        <View className="flex-row items-end justify-between mb-3">
          <Text className="text-ink text-xl font-extrabold tracking-tight">
            {t('home.powerMoves', { defaultValue: 'Power moves' })}
          </Text>
          <Text className="text-ink-muted text-xs">
            {t('home.poweredByAI', { defaultValue: 'Powered by AI' })}
          </Text>
        </View>

        {banner.data?.show && banner.data.programId ? (
          <FeatureCard
            tag={t('home.weeklyReview', { defaultValue: 'Weekly review' })}
            time={t('home.ready', { defaultValue: 'Ready' })}
            title={t('home.programReview', {
              defaultValue: 'Your program review is ready',
            })}
            tagline={t('home.adaptiveAI', {
              defaultValue: 'Adaptive AI',
            })}
            chips={[
              { icon: 'sparkles', label: t('home.chip.ai') },
              { icon: 'trending', label: t('home.chip.adapt') },
              { icon: 'target', label: t('home.chip.tuned') },
            ]}
            gradient={['#FF4D2E', '#F97316']}
            icon="sparkles"
            onPress={() =>
              void requireAuth(
                () => router.push(`/program-adjust?program_id=${banner.data!.programId}` as never),
                aiPrompt,
              )
            }
            highlight
          />
        ) : null}

        <FeatureCard
          tag={t('home.aiVision', { defaultValue: 'AI Vision' })}
          time={t('home.twoMin')}
          title={t('home.formCheckTitle', { defaultValue: 'AI Form Check' })}
          tagline={t('home.formCheckTagline', {
            defaultValue: 'Record a set, get pro feedback',
          })}
          chips={[
            { icon: 'camera', label: t('home.chip.live') },
            { icon: 'target', label: t('home.chip.cues') },
            { icon: 'medal', label: t('home.chip.pro') },
          ]}
          gradient={['#0F172A', '#7C2D12', '#F97316']}
          icon="play"
          onPress={() => goAI('/form-check')}
        />

        <FeatureCard
          tag={t('home.aiScan', { defaultValue: 'AI Scan' })}
          time={t('home.snap')}
          title={t('home.equipmentScanTitle', { defaultValue: 'Scan any equipment' })}
          tagline={t('home.equipmentScanTagline', {
            defaultValue: 'Hotel, gym, or home — we adapt',
          })}
          chips={[
            { icon: 'camera', label: t('home.chip.vision') },
            { icon: 'search', label: t('home.chip.detect') },
            { icon: 'list', label: t('home.chip.plan') },
          ]}
          gradient={['#1A0A1F', '#7E22CE', '#A855F7']}
          icon="camera"
          onPress={() => goAI('/scan')}
        />

        <View style={{ height: 130 }} />
      </View>

      <CalendarSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        getDayCompletion={getDayCompletion}
      />
    </Screen>
  );
}

// Deterministic mock so historical days render consistently across renders.
// Replace with real activity data once the backend is wired up.
function mockHistoricalCompletion(d: Date): number {
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  // xorshift32-ish — small, fast, and stable.
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const r = ((x >>> 0) % 1000) / 1000;
  if (r < 0.65) return 1; // online
  if (r < 0.85) return 0.4 + (r - 0.65) * 2; // partial 0.4–0.8
  return 0; // off
}

const softShadow = {
  shadowColor: '#F4F4F5',
  shadowOpacity: 0.04,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

const STEPS_DAILY_TARGET = 10000;
const SLEEP_DAILY_TARGET_MIN = 480; // 8h
const ACTIVE_MIN_DAILY_TARGET = 30; // WHO baseline

type Translate = ReturnType<typeof useTranslation>['t'];

function HeroCard({
  value,
  target,
  label,
  ringPct,
  ringIcon,
  ringGradientId,
  ringGradient,
  chips,
}: {
  value: string;
  target: string;
  label: string;
  ringPct: number;
  ringIcon: IconName;
  ringGradientId: string;
  ringGradient: [string, string];
  chips?: { icon: IconName; value: string }[];
}) {
  return (
    <View className="bg-bg-raised rounded-3xl p-5 border border-border mb-3" style={softShadow}>
      <View className="flex-row items-start">
        <View className="flex-1">
          <View className="flex-row items-baseline">
            <Text
              className="text-ink font-extrabold tracking-tight"
              style={{ fontSize: 40, lineHeight: 44 }}
            >
              {value}
            </Text>
            <Text className="text-ink-muted text-lg font-bold ml-1">/{target}</Text>
          </View>
          <View className="flex-row items-center mt-1">
            <Text className="text-ink-subtle text-sm">{label}</Text>
          </View>

          {chips && chips.length > 0 ? (
            <View className="flex-row mt-4" style={{ gap: 6 }}>
              {chips.map((chip, i) => (
                <BurnChip key={i} icon={chip.icon} value={chip.value} />
              ))}
            </View>
          ) : null}
        </View>

        <HeroRing
          pct={ringPct}
          icon={ringIcon}
          gradient={ringGradient}
          gradientId={ringGradientId}
          size={108}
        />
      </View>
    </View>
  );
}

function HeroRing({
  pct,
  icon,
  gradient,
  gradientId,
  size,
}: {
  pct: number;
  icon: IconName;
  gradient: [string, string];
  gradientId: string;
  size: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#27272F"
          strokeWidth={stroke}
          fill="none"
        />
        {clamped > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - clamped)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Icon name={icon} size={28} color={gradient[1]} />
      </View>
    </View>
  );
}

function NutritionPage({
  t,
  kcalEaten,
  kcalTarget,
  protein,
  proteinTarget,
  carbs,
  carbsTarget,
  fat,
  fatTarget,
  burnedExercise,
  burnedSteps,
}: {
  t: Translate;
  kcalEaten: number;
  kcalTarget: number;
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbsTarget: number;
  fat: number;
  fatTarget: number;
  burnedExercise: number;
  burnedSteps: number;
}) {
  const pct = kcalTarget > 0 ? kcalEaten / kcalTarget : 0;
  return (
    <View>
      <HeroCard
        value={String(kcalEaten)}
        target={String(kcalTarget)}
        label={t('home.caloriesEaten', { defaultValue: 'Calories eaten' })}
        ringPct={pct}
        ringIcon="flame"
        ringGradientId="calRing"
        ringGradient={['#FFFFFF', '#A1A1AA']}
        chips={[
          { icon: 'clock', value: `+${burnedExercise}` },
          { icon: 'bar-chart', value: `+${burnedSteps}` },
        ]}
      />
      <View className="flex-row mb-3" style={{ gap: 10 }}>
        <MacroCard
          value={protein}
          target={proteinTarget}
          label={t('home.proteinEaten', { defaultValue: 'Protein eaten' })}
          gradient={['#FB7185', '#E11D48']}
          gradientId="proteinRing"
          icon="droplet"
        />
        <MacroCard
          value={carbs}
          target={carbsTarget}
          label={t('home.carbsEaten', { defaultValue: 'Carbs eaten' })}
          gradient={['#FBBF24', '#D97706']}
          gradientId="carbsRing"
          icon="leaf"
        />
        <MacroCard
          value={fat}
          target={fatTarget}
          label={t('home.fatEaten', { defaultValue: 'Fat eaten' })}
          gradient={['#60A5FA', '#1D4ED8']}
          gradientId="fatRing"
          icon="droplet"
        />
      </View>
    </View>
  );
}

function ActivityPage({
  t,
  steps,
  workoutsCount,
  workoutsMinutes,
  workoutsDistanceM,
  activeKcal,
  stepKcal,
}: {
  t: Translate;
  steps: number;
  workoutsCount: number;
  workoutsMinutes: number;
  workoutsDistanceM: number;
  activeKcal: number;
  stepKcal: number;
}) {
  const stepsPct = steps / STEPS_DAILY_TARGET;
  const distanceKm = workoutsDistanceM / 1000;
  const distanceDisplay =
    distanceKm <= 0
      ? '0'
      : distanceKm < 10
        ? (Math.round(distanceKm * 10) / 10).toString()
        : Math.round(distanceKm).toString();
  return (
    <View>
      <HeroCard
        value={steps.toLocaleString()}
        target={STEPS_DAILY_TARGET.toLocaleString()}
        label={t('home.stepsToday', { defaultValue: 'Steps today' })}
        ringPct={stepsPct}
        ringIcon="bar-chart"
        ringGradientId="stepsRing"
        ringGradient={['#34D399', '#059669']}
        chips={[{ icon: 'flame', value: `${activeKcal + stepKcal} kcal` }]}
      />
      <View className="flex-row mb-3" style={{ gap: 10 }}>
        <MacroCard
          value={workoutsMinutes}
          target={ACTIVE_MIN_DAILY_TARGET}
          label={t('home.activeMin', { defaultValue: 'Active min' })}
          gradient={['#FB923C', '#EA580C']}
          gradientId="activeMinRing"
          icon="dumbbell"
          unit="min"
        />
        <BiometricCard
          value={String(workoutsCount)}
          unit=""
          label={t('home.workouts', { defaultValue: 'Workouts' })}
          gradient={['#A78BFA', '#7C3AED']}
          icon="medal"
        />
        <BiometricCard
          value={distanceDisplay}
          unit={distanceKm > 0 ? 'km' : ''}
          label={t('home.distance', { defaultValue: 'Distance' })}
          gradient={['#22D3EE', '#0891B2']}
          icon="ruler"
        />
      </View>
    </View>
  );
}

function RecoveryPage({
  t,
  sleepMinutes,
  restingHr,
  hrv,
  weightKg,
}: {
  t: Translate;
  sleepMinutes: number | null;
  restingHr: number | null;
  hrv: number | null;
  weightKg: number | null;
}) {
  const sleepHours = sleepMinutes != null ? sleepMinutes / 60 : 0;
  const sleepPct = sleepMinutes != null ? sleepMinutes / SLEEP_DAILY_TARGET_MIN : 0;
  const sleepDisplay = sleepMinutes != null ? `${Math.round(sleepHours * 10) / 10}h` : '—';
  return (
    <View>
      <HeroCard
        value={sleepDisplay}
        target="8h"
        label={t('home.sleptLastNight', { defaultValue: 'Slept last night' })}
        ringPct={sleepPct}
        ringIcon="clock"
        ringGradientId="sleepRing"
        ringGradient={['#A5B4FC', '#4F46E5']}
      />
      <View className="flex-row mb-3" style={{ gap: 10 }}>
        <BiometricCard
          value={restingHr != null ? String(restingHr) : '—'}
          unit={restingHr != null ? 'bpm' : ''}
          label={t('home.restingHr', { defaultValue: 'Resting HR' })}
          gradient={['#F43F5E', '#BE123C']}
          icon="heart"
        />
        <BiometricCard
          value={hrv != null ? String(hrv) : '—'}
          unit={hrv != null ? 'ms' : ''}
          label={t('home.hrv', { defaultValue: 'HRV' })}
          gradient={['#60A5FA', '#1D4ED8']}
          icon="trending"
        />
        <BiometricCard
          value={weightKg != null ? String(weightKg) : '—'}
          unit={weightKg != null ? 'kg' : ''}
          label={t('home.weight', { defaultValue: 'Weight' })}
          gradient={['#FCD34D', '#D97706']}
          icon="scale"
        />
      </View>
    </View>
  );
}

function BiometricCard({
  value,
  unit,
  label,
  gradient,
  icon,
}: {
  value: string;
  unit: string;
  label: string;
  gradient: [string, string];
  icon: IconName;
}) {
  return (
    <View
      className="bg-bg-raised rounded-3xl p-3.5 border border-border"
      style={[{ flex: 1 }, softShadow]}
    >
      <View className="flex-row items-baseline">
        <Text className="text-ink text-2xl font-extrabold tracking-tight">{value}</Text>
        {unit ? <Text className="text-ink-muted text-sm font-bold ml-0.5">{unit}</Text> : null}
      </View>
      <Text className="text-ink-subtle text-[11px] mt-0.5" numberOfLines={1}>
        {label}
      </Text>
      <View className="items-center mt-2">
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#27272F',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: `${gradient[1]}40`,
          }}
        >
          <Icon name={icon} size={20} color={gradient[1]} />
        </View>
      </View>
    </View>
  );
}

function DayRing({
  value,
  active,
  dim,
  number,
}: {
  value: number;
  active: boolean;
  dim: boolean;
  number: number;
}) {
  const size = 36;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const trackColor = active ? '#3F3F46' : '#27272F';
  const ringColor = pct >= 1 ? '#22C55E' : '#84CC16';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: active ? '#27272F' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={dim ? `${c / 32},${c / 32}` : undefined}
        />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text
        className={`text-xs font-bold ${
          dim ? 'text-ink-muted/60' : active ? 'text-ink' : 'text-ink'
        }`}
      >
        {number}
      </Text>
    </View>
  );
}

function BurnChip({ icon, value }: { icon: IconName; value: string }) {
  return (
    <View className="flex-row items-center px-2.5 py-1.5 rounded-full bg-bg-subtle">
      <View className="w-5 h-5 rounded-full items-center justify-center bg-bg-raised mr-1.5">
        <Icon name={icon} size={9} color="#F4F4F5" />
      </View>
      <Text className="text-ink text-xs font-bold">{value}</Text>
    </View>
  );
}

function MacroCard({
  value,
  target,
  label,
  gradient,
  gradientId,
  icon,
  unit = 'g',
}: {
  value: number;
  target: number;
  label: string;
  gradient: [string, string];
  gradientId: string;
  icon: IconName;
  unit?: string;
}) {
  const pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  return (
    <View
      className="bg-bg-raised rounded-3xl p-3.5 border border-border"
      style={[{ flex: 1 }, softShadow]}
    >
      <View className="flex-row items-baseline">
        <Text className="text-ink text-2xl font-extrabold tracking-tight">{value}</Text>
        <Text className="text-ink-muted text-sm font-bold ml-0.5">
          /{target}
          {unit}
        </Text>
      </View>
      <Text className="text-ink-subtle text-[11px] mt-0.5" numberOfLines={1}>
        {label}
      </Text>
      <View className="items-center mt-2">
        <MacroArc pct={pct} gradient={gradient} gradientId={gradientId} icon={icon} size={64} />
      </View>
    </View>
  );
}

function MacroArc({
  pct,
  gradient,
  gradientId,
  icon,
  size,
}: {
  pct: number;
  gradient: [string, string];
  gradientId: string;
  icon: IconName;
  size: number;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#27272F"
          strokeWidth={stroke}
          fill="none"
        />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Icon name={icon} size={18} color={gradient[1]} />
      </View>
    </View>
  );
}

function ContinueCTA({
  title,
  tagline,
  cta,
  onPress,
}: {
  title: string;
  tagline: string;
  cta: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 20, stiffness: 400 }))}
    >
      <Animated.View
        className="rounded-2xl overflow-hidden mb-5"
        style={[
          animatedStyle,
          {
            shadowColor: '#10B981',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 10,
          },
        ]}
      >
        <LinearGradient
          colors={
            ['#064E3B', '#10B981', '#34D399'] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16 }}
        >
          <View className="flex-row items-center">
            <View
              className="rounded-2xl items-center justify-center border border-white/25 mr-3"
              style={{
                width: 48,
                height: 48,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Icon name="play" size={20} color="#FFFFFF" />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center mb-0.5" style={{ gap: 5 }}>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: '#FFFFFF',
                  }}
                />
                <Text
                  className="text-white text-[9px] font-extrabold uppercase"
                  style={{ letterSpacing: 1.2, opacity: 0.9 }}
                >
                  {t('home.activeProgram')}
                </Text>
              </View>
              <Text
                className="text-white text-[16px] font-extrabold tracking-tight"
                style={{ lineHeight: 19 }}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text
                className="text-white/85 text-[11px]"
                style={{ lineHeight: 14, marginTop: 1 }}
                numberOfLines={1}
              >
                {tagline}
              </Text>
            </View>
          </View>

          <View
            className="flex-row items-center justify-center mt-3 rounded-xl"
            style={{
              backgroundColor: '#FFFFFF',
              paddingVertical: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Text
              className="text-[13px] font-extrabold tracking-tight mr-1.5"
              style={{ color: '#0B0B0F' }}
            >
              {cta}
            </Text>
            <Icon name="chevron-right" size={14} color="#0B0B0F" />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function MealCTA({
  title,
  tagline,
  cta,
  onPress,
}: {
  title: string;
  tagline: string;
  cta: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 20, stiffness: 400 }))}
    >
      <Animated.View
        className="rounded-3xl overflow-hidden mb-5"
        style={[
          animatedStyle,
          {
            shadowColor: '#FB7185',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.4,
            shadowRadius: 28,
            elevation: 12,
          },
        ]}
      >
        <LinearGradient
          colors={
            ['#7F1D1D', '#DC2626', '#FB923C'] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 18 }}
        >
          <View className="flex-row items-center">
            {/* Premium camera tile */}
            <View
              className="rounded-2xl overflow-hidden mr-3.5 border border-white/30"
              style={{
                width: 60,
                height: 60,
                backgroundColor: 'rgba(255,255,255,0.18)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
              }}
            >
              <View className="absolute inset-0 items-center justify-center">
                <Icon name="camera" size={26} color="#FFFFFF" />
              </View>
              {/* Tiny sparkle accent */}
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                }}
              >
                <Icon name="sparkles" size={10} color="#FDE68A" />
              </View>
            </View>

            {/* Copy */}
            <View className="flex-1">
              <View className="flex-row items-center mb-1" style={{ gap: 5 }}>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: '#FDE68A',
                    shadowColor: '#FDE68A',
                    shadowOpacity: 0.9,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />
                <Text
                  className="text-[10px] font-extrabold uppercase"
                  style={{ color: '#FDE68A', letterSpacing: 1.4 }}
                >
                  {t('home.aiMealVision')}
                </Text>
              </View>
              <Text
                className="text-white text-[18px] font-extrabold tracking-tight"
                style={{ lineHeight: 22 }}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text
                className="text-white/85 text-[12px]"
                style={{ lineHeight: 15, marginTop: 2 }}
                numberOfLines={1}
              >
                {tagline}
              </Text>
            </View>
          </View>

          {/* Feature chip row */}
          <View className="flex-row mt-3.5" style={{ gap: 6 }}>
            <MealChip icon="flame" label={t('home.chip.calories')} />
            <MealChip icon="flask" label={t('home.chip.macros')} />
            <MealChip icon="zap" label={t('home.chip.instant')} />
          </View>

          {/* CTA pill */}
          <View
            className="flex-row items-center justify-center mt-3.5 rounded-2xl"
            style={{
              backgroundColor: '#FFFFFF',
              paddingVertical: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.18,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Icon name="camera" size={15} color="#0B0B0F" />
            <Text
              className="text-[14px] font-extrabold tracking-tight mx-2"
              style={{ color: '#0B0B0F' }}
            >
              {cta}
            </Text>
            <Icon name="chevron-right" size={14} color="#0B0B0F" />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function MealChip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 9,
        paddingVertical: 5,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
      }}
    >
      <Icon name={icon} size={11} color="#FFFFFF" />
      <Text className="text-white text-[10px] font-extrabold ml-1" style={{ letterSpacing: 0.4 }}>
        {label}
      </Text>
    </View>
  );
}

function StartCTA({
  title,
  tagline,
  cta,
  onPress,
}: {
  title: string;
  tagline: string;
  cta: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 20, stiffness: 400 }))}
    >
      <Animated.View
        className="rounded-2xl overflow-hidden mb-5"
        style={[
          animatedStyle,
          {
            shadowColor: '#F97316',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 10,
          },
        ]}
      >
        <LinearGradient
          colors={
            ['#FF4D2E', '#F97316', '#FB923C'] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16 }}
        >
          <View className="flex-row items-center">
            {/* Icon */}
            <View
              className="rounded-2xl items-center justify-center border border-white/25 mr-3"
              style={{
                width: 48,
                height: 48,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Icon name="zap" size={22} color="#FFFFFF" />
            </View>

            {/* Copy */}
            <View className="flex-1">
              <View className="flex-row items-center mb-0.5" style={{ gap: 5 }}>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: '#FFFFFF',
                  }}
                />
                <Text
                  className="text-white text-[9px] font-extrabold uppercase"
                  style={{ letterSpacing: 1.2, opacity: 0.9 }}
                >
                  {t('home.getStarted')}
                </Text>
              </View>
              <Text
                className="text-white text-[16px] font-extrabold tracking-tight"
                style={{ lineHeight: 19 }}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text
                className="text-white/80 text-[11px]"
                style={{ lineHeight: 14, marginTop: 1 }}
                numberOfLines={1}
              >
                {tagline}
              </Text>
            </View>
          </View>

          {/* CTA pill */}
          <View
            className="flex-row items-center justify-center mt-3 rounded-xl"
            style={{
              backgroundColor: '#FFFFFF',
              paddingVertical: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Text
              className="text-[13px] font-extrabold tracking-tight mr-1.5"
              style={{ color: '#0B0B0F' }}
            >
              {cta}
            </Text>
            <Icon name="chevron-right" size={14} color="#0B0B0F" />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function FeatureCard({
  tag,
  time,
  title,
  tagline,
  gradient,
  icon,
  onPress,
  highlight,
}: {
  tag: string;
  time: string;
  title: string;
  tagline: string;
  chips?: { icon: IconName; label: string }[];
  gradient: string[];
  icon: IconName;
  onPress: () => void;
  highlight?: boolean;
}) {
  const pressedScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pressedScale.value }],
    };
  });

  const handlePressIn = () => {
    pressedScale.value = withSpring(0.96, {
      damping: 20,
      stiffness: 400,
    });
  };

  const handlePressOut = () => {
    pressedScale.value = withSpring(1, {
      damping: 20,
      stiffness: 400,
    });
  };

  // Extract primary color from gradient for glow effect
  const primaryColor = gradient[0];

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [animatedStyle, pressed && { opacity: 0.98 }]}
    >
      <Animated.View
        className="rounded-2xl overflow-hidden mb-2"
        style={[
          {
            backgroundColor: '#17171B',
            borderWidth: 1,
            borderColor: highlight ? `${primaryColor}30` : '#27272F',
            shadowColor: primaryColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: highlight ? 0.22 : 0.1,
            shadowRadius: highlight ? 22 : 12,
            elevation: highlight ? 8 : 3,
          },
        ]}
      >
        {/* Top accent hairline */}
        <LinearGradient
          colors={
            [
              'transparent',
              `${primaryColor}80`,
              `${primaryColor}40`,
              'transparent',
            ] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            height: 1,
            width: '100%',
          }}
        />

        {/* Right-side radial accent wash */}
        <LinearGradient
          colors={
            ['transparent', `${primaryColor}10`] as unknown as readonly [
              string,
              string,
              ...string[],
            ]
          }
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '60%',
          }}
        />

        <View className="flex-row items-center px-3 py-2.5">
          {/* Premium thumbnail */}
          <View
            className="rounded-xl overflow-hidden mr-3"
            style={{
              width: 48,
              height: 48,
              shadowColor: primaryColor,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <LinearGradient
              colors={gradient as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Glossy diagonal highlight */}
              <LinearGradient
                colors={
                  ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'] as unknown as readonly [
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
              <Icon name={icon} size={20} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Content */}
          <View className="flex-1">
            {/* Tag row with status dot */}
            <View className="flex-row items-center mb-1" style={{ gap: 6 }}>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: primaryColor,
                  shadowColor: primaryColor,
                  shadowOpacity: 0.8,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
              <Text
                className="text-[9px] font-extrabold uppercase"
                style={{ color: primaryColor, letterSpacing: 1 }}
                numberOfLines={1}
              >
                {tag}
              </Text>
              <View
                className="rounded-full px-1.5"
                style={{
                  paddingVertical: 1,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: '#27272F',
                }}
              >
                <Text
                  className="text-ink-muted text-[8px] font-bold uppercase"
                  style={{ letterSpacing: 0.8 }}
                >
                  {time}
                </Text>
              </View>
            </View>

            <Text
              className="text-ink text-[14px] font-extrabold tracking-tight"
              style={{ lineHeight: 17 }}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              className="text-ink-subtle text-[11px]"
              style={{ lineHeight: 14, marginTop: 1 }}
              numberOfLines={1}
            >
              {tagline}
            </Text>
          </View>

          {/* Arrow affordance */}
          <View
            className="ml-2 items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: `${primaryColor}1A`,
              borderWidth: 1,
              borderColor: `${primaryColor}30`,
            }}
          >
            <Icon name="chevron-right" size={13} color={primaryColor} />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
