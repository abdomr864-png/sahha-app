/* eslint-disable max-lines -- Home bento grid: aspirational 300-line cap; refactor tracked separately. */
import { useCallback, useRef, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { CalendarSheet, Icon, Screen } from '@features/shared';
import type { IconName } from '@features/shared';
import { useRequireAuth } from '@features/auth';
import { useWeeklyAdjustmentBanner, useHasProgram } from '@features/ai-program-adjust';
// Import the draft store from its module directly (not the feature barrel): the
// barrel pulls the entire ai-routine-gen component graph — and transitively
// @features/workouts — into the app's entry route, which can trigger a runtime
// require-cycle init crash on launch. The store module has no such deps.
import { useDraftRoutineStore } from '@features/ai-routine-gen/store';
import { useTodayNutrition, useActivityCalendar } from '@features/ai-meal-parse';
import { useDailyTargets, useActivityTargets } from '@features/onboarding';
import { useTodayHealthMetrics, RecoveryPage } from '@features/health';
import { TodayCard } from '@features/readiness';
import { RecoveryWeekBanner, useStreak } from '@features/streaks';
// Import from the hooks module directly (not the @features/strength barrel) to
// keep the strength component graph + reanimated out of the home entry route —
// same require-cycle precaution as the draft-routine store import above.
import { useStrengthSync } from '@features/strength/hooks/useRecomputeStrength';
import { useUserBadges } from '@features/strength/hooks/useStrength';

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
  // A program the user generated but hasn't committed to the DB yet still lives
  // in the local draft store (persisted across launches). Treat it as "having a
  // program" so it resurfaces instead of silently disappearing.
  const hasDraftProgram = useDraftRoutineStore((s) => s.draft?.kind === 'program');
  const nutrition = useTodayNutrition();
  const activity = useActivityCalendar();
  const targets = useDailyTargets();
  const activityTargets = useActivityTargets();
  const health = useTodayHealthMetrics();
  const qc = useQueryClient();

  // Recompute strength estimates + badges when Home regains focus (debounced
  // app-wide), so a workout finished elsewhere updates the user's levels. The
  // recompute mutation invalidates the ['strength'] queries on success.
  useStrengthSync();
  const { data: earnedBadges } = useUserBadges();
  const badgeCount = earnedBadges?.length ?? 0;

  // Refresh today's nutrition + activity/recovery whenever Home regains focus,
  // so a meal logged or a workout finished elsewhere shows up on return (the
  // in-app workout persist is async, so we can't rely on a direct invalidation).
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ['today-nutrition'] });
      qc.invalidateQueries({ queryKey: ['today-health'] });
      qc.invalidateQueries({ queryKey: ['activity-calendar'] });
      // Recovery score + its training-load input share the dashboard's
      // focus-refresh + midnight-rollover pattern (the baseline shifts slowly,
      // so refetchOnWindowFocus covers it without an explicit invalidation).
      qc.invalidateQueries({ queryKey: ['recovery-load'] });
    }, [qc]),
  );
  // Gate on the data value itself (not isFetched) so the CTA renders instantly
  // from the persisted initialData on cold launch. While data is still
  // undefined (first ever launch with no cache) we render neither, which
  // matches the prior loading behavior.
  const hasSavedProgram = hasProgram.data === true;
  // "Continue" wins whenever a program exists in either place; only offer the
  // first-run "Ready to start" when we're sure there's nothing to come back to.
  const showContinueCTA = hasSavedProgram || hasDraftProgram;
  const showStartCTA = hasProgram.data === false && !hasDraftProgram;
  const requireAuth = useRequireAuth();

  // AI features need a profile to personalize. Guests can see the home
  // tab, but tapping any AI CTA prompts sign-in first.
  const aiPrompt = t('auth.gate.aiPrompt', {
    defaultValue: 'Create an account so the AI can tune training and macros to you.',
  });
  const goAI = (
    route:
      | '/program-gen'
      | '/routines'
      | '/meal-quick-log'
      | '/form-check'
      | '/scan'
      | '/ai-coach'
      | '/what-can-i-eat',
  ) => void requireAuth(() => router.push(route as never), aiPrompt);

  // Continue routes to the saved program list when one is committed, otherwise
  // to the preview of the still-unsaved generated draft so it can be reviewed
  // and saved instead of lost.
  const onContinue = () =>
    void requireAuth(
      () =>
        router.push(
          (hasSavedProgram ? '/routines' : '/routines/generate-program/preview') as never,
        ),
      aiPrompt,
    );

  const { data: streakRow } = useStreak();
  const streak = streakRow?.current_streak ?? 0;
  const kcalEaten = nutrition.data?.kcalEaten ?? 0;
  const protein = nutrition.data?.protein ?? 0;
  const carbs = nutrition.data?.carbs ?? 0;
  const fat = nutrition.data?.fat ?? 0;
  const kcalTarget = targets.data?.kcal ?? 2400;
  const proteinTarget = targets.data?.proteinG ?? 160;
  const carbsTarget = targets.data?.carbsG ?? 280;
  const fatTarget = targets.data?.fatG ?? 75;

  const today = new Date();
  const weekStart = startOfWeekSun(today);
  const todayIdx = today.getDay();
  // Real per-day completion (logged meals + workouts), synchronous lookup.
  const getDayCompletion = activity.getDayCompletion;
  // This week's 7 days, resolved to their real dates so the strip reflects
  // actual activity rather than a static mock.
  const weekCompletion = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return getDayCompletion(d);
  });

  const [calendarOpen, setCalendarOpen] = useState(false);

  const { width: winW } = useWindowDimensions();
  const PAGER_PADDING = 20; // matches px-5 on the wrapper
  const pagerW = Math.max(0, winW - PAGER_PADDING * 2);
  const pagerRef = useRef<ScrollView>(null);
  const [pagerIndex, setPagerIndex] = useState(0);
  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pagerW <= 0) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / pagerW);
    if (i !== pagerIndex) setPagerIndex(i);
  };
  const goToPage = (i: number) => {
    if (pagerW <= 0) return;
    pagerRef.current?.scrollTo({ x: i * pagerW, animated: true });
    setPagerIndex(i);
  };

  // Time-based greeting headline (matches the Sahha design's home header).
  const hour = today.getHours();
  const greeting =
    hour < 12
      ? t('home.greetingMorning', { defaultValue: 'Good morning' })
      : hour < 18
        ? t('home.greetingAfternoon', { defaultValue: 'Good afternoon' })
        : t('home.greetingEvening', { defaultValue: 'Good evening' });
  const pagerTabs = [
    t('home.nutrition', { defaultValue: 'Nutrition' }),
    t('home.activity', { defaultValue: 'Activity' }),
    t('home.recovery', { defaultValue: 'Recovery' }),
  ];

  const stepsCount = health.data?.steps ?? 0;
  const workoutsCount = health.data?.workoutsCount ?? 0;
  const workoutsMinutes = health.data?.workoutsMinutes ?? 0;
  const workoutsDistanceM = health.data?.workoutsDistanceM ?? 0;
  const workoutsVolumeKg = health.data?.workoutsVolumeKg ?? 0;
  // Activity targets are now personalized (was: hard-coded constants). The
  // Recovery page reads its own data + personalized sleep goal internally.
  const stepsTarget = activityTargets.data?.stepsTarget ?? 10000;
  const activeMinutesTarget = activityTargets.data?.activeMinutesTarget ?? 30;

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
              <Icon name="apple" size={18} color="#F4F4F7" />
            </View>
            <Text className="text-ink text-2xl font-extrabold tracking-tight">Sahha</Text>
          </Pressable>

          <View className="flex-row items-center" style={{ gap: 8 }}>
            {/* Badges — opens the Strength screen on its badge gallery */}
            <Pressable
              onPress={() => router.push('/strength?tab=badges')}
              accessibilityRole="button"
              accessibilityLabel={t('strength.openBadges', { defaultValue: 'Open badges' })}
              className="w-9 h-9 rounded-full bg-bg-raised border border-border items-center justify-center"
            >
              <Icon name="medal" size={16} color="#F5C451" />
              {badgeCount > 0 ? (
                <View
                  className="absolute items-center justify-center rounded-full"
                  style={{
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 4,
                    backgroundColor: '#FF4D2E',
                    borderWidth: 1.5,
                    borderColor: '#0A0A0F',
                  }}
                >
                  <Text
                    className="text-white text-[10px] font-extrabold"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {badgeCount}
                  </Text>
                </View>
              ) : null}
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
        </View>

        {/* Greeting headline — Sahha design */}
        <View className="mb-5">
          <Text className="text-ink-subtle text-sm">{greeting}</Text>
          <Text className="text-ink text-[27px] font-display tracking-tight mt-0.5">
            {t('home.letsLift', { defaultValue: 'Let’s lift.' })}
          </Text>
        </View>

        {/* Today's readiness verdict — the flagship Pro surface (Feature 1).
            Self-gates on its feature flag + Pro entitlement; renders nothing
            when flagged off, an upsell when free, the verdict when entitled. */}
        <TodayCard />

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
            const isToday = i === todayIdx;
            const isFuture = i > todayIdx;
            const pct = weekCompletion[i] ?? 0;
            return (
              <View key={labelKey} className="items-center" style={{ flex: 1, gap: 6 }}>
                <DayRing value={isFuture ? 0 : pct} active={isToday} dim={isFuture} />
                <Text
                  className={`text-[11px] font-bold ${
                    isToday ? 'text-accent-bright' : 'text-ink-muted'
                  }`}
                >
                  {t(labelKey)}
                </Text>
              </View>
            );
          })}
        </Pressable>

        {/* Pager section tabs — Nutrition · Activity · Recovery (Sahha design) */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row" style={{ gap: 16 }}>
            {pagerTabs.map((label, i) => {
              const active = pagerIndex === i;
              return (
                <Pressable key={label} onPress={() => goToPage(i)} accessibilityRole="button">
                  <Text
                    className={`text-lg font-display tracking-tight ${
                      active ? 'text-ink' : 'text-ink-muted'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {[0, 1, 2].map((i) => {
              const active = pagerIndex === i;
              return (
                <View
                  key={i}
                  style={{
                    width: active ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: active ? '#FF7A1A' : 'rgba(180,180,194,0.30)',
                  }}
                />
              );
            })}
          </View>
        </View>

        {/* Stat pager — swipe between Nutrition / Activity / Recovery */}
        <ScrollView
          ref={pagerRef}
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
            />
          </View>
          <View style={{ width: pagerW }}>
            <ActivityPage
              t={t}
              steps={stepsCount}
              stepsTarget={stepsTarget}
              activeMinutesTarget={activeMinutesTarget}
              workoutsCount={workoutsCount}
              workoutsMinutes={workoutsMinutes}
              workoutsDistanceM={workoutsDistanceM}
              workoutsVolumeKg={workoutsVolumeKg}
            />
          </View>
          <View style={{ width: pagerW }}>
            {/* Personalized recovery/readiness — owns its own data + deload card. */}
            <RecoveryPage />
          </View>
        </ScrollView>

        <View className="mb-6" />

        {/* Start CTA — shown only to users without a program (flame) */}
        {showStartCTA ? (
          <CTACard
            gradient={['#FF8A2B', '#FF4D2E', '#FF2D55']}
            glowColor="#FF4D2E"
            icon="zap"
            kicker={t('home.getStarted', { defaultValue: 'Get started' })}
            title={t('home.startTitle', { defaultValue: 'Ready to start?' })}
            sub={t('home.startTagline', {
              defaultValue: 'Build your AI program in 30 seconds',
            })}
            onPress={() => goAI('/program-gen')}
          />
        ) : null}

        {/* Continue CTA — shown when user already has a saved program (green) */}
        {showContinueCTA ? (
          <CTACard
            gradient={['#34E89E', '#12B886']}
            glowColor="#12B886"
            icon="play"
            kicker={t('home.activeProgram', { defaultValue: 'Active program' })}
            title={t('home.continueTitle', {
              defaultValue: "Let's continue",
            })}
            sub={t('home.continueTagline', {
              defaultValue: 'Your program is ready — pick up where you left off',
            })}
            onPress={onContinue}
          />
        ) : null}

        {/* Premium meal-snap CTA — primary food-logging entry point (red) */}
        <CTACard
          gradient={['#FF6B8A', '#C9184A']}
          glowColor="#C9184A"
          icon="camera"
          kicker={t('home.aiMealVision', { defaultValue: 'AI meal · vision' })}
          title={t('home.mealParseTitle', { defaultValue: 'Snap a meal' })}
          sub={t('home.mealParseTaglinePro', {
            defaultValue: 'Photo → calories, macros, instant',
          })}
          onPress={() => goAI('/meal-quick-log')}
        />

        {/* Power moves — 3-card feature deck (Sahha design) */}
        <Text
          className="text-ink-muted text-xs font-bold uppercase mb-3"
          style={{ letterSpacing: 2.5 }}
        >
          {t('home.powerMoves', { defaultValue: 'Power moves' })}
        </Text>

        <View className="flex-row" style={{ gap: 10 }}>
          <PowerMove
            icon="trending"
            gradient={['#FF8A2B', '#FF2D55']}
            title={t('home.weeklyReview', { defaultValue: 'Weekly review' })}
            sub={t('home.weeklyReviewSub', { defaultValue: '+12% volume' })}
            onPress={() =>
              banner.data?.show && banner.data.programId
                ? void requireAuth(
                    () =>
                      router.push(`/program-adjust?program_id=${banner.data!.programId}` as never),
                    aiPrompt,
                  )
                : router.push('/(tabs)/progress')
            }
          />
          <PowerMove
            icon="apple"
            gradient={['#A3E635', '#16A34A']}
            title={t('home.whatToEat', { defaultValue: 'What to eat' })}
            sub={t('home.whatToEatSub', { defaultValue: 'Macro-fit meals' })}
            onPress={() => goAI('/what-can-i-eat')}
          />
          <PowerMove
            icon="camera"
            gradient={['#34E89E', '#12B886']}
            title={t('home.aiScan', { defaultValue: 'AI Scan' })}
            sub={t('home.aiScanSub', { defaultValue: 'Any machine' })}
            onPress={() => goAI('/scan')}
          />
        </View>

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

// Tight, downward-only shadow. A wide blur (radius 10) used to halo each card,
// and when cards stacked vertically the halos met in the gap and the rounded
// corners pinched the seam into a triangle — making the cards read as a single
// continuous strip. A small radius keeps the shadow inside the card footprint.
const softShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

// Shared fixed height for the small stat cards (Macro / Biometric / Recovery
// factor). Each pager page stretches its card row to the tallest card, so
// without a shared height the Nutrition / Activity / Recovery pages render at
// different heights. Pinning every stat card to one height keeps the three
// pager pages identical. Kept in sync with RecoveryPage's STAT_CARD_HEIGHT.
const STAT_CARD_HEIGHT = 150;

type Translate = ReturnType<typeof useTranslation>['t'];

function HeroCard({
  ringPct,
  ringGradientId,
  ringGradient,
  centerValue,
  centerSub,
  kicker,
  kickerIcon,
  headline,
  headlineUnit,
  sub,
}: {
  ringPct: number;
  ringGradientId: string;
  ringGradient: [string, string];
  centerValue: string;
  centerSub: string;
  kicker: string;
  kickerIcon: IconName;
  headline: string;
  headlineUnit?: string;
  sub?: string;
}) {
  return (
    <View className="bg-bg-subtle rounded-3xl p-4 border border-border mb-4" style={softShadow}>
      <View className="flex-row items-center">
        <HeroRing
          pct={ringPct}
          gradient={ringGradient}
          gradientId={ringGradientId}
          size={94}
          centerValue={centerValue}
          centerSub={centerSub}
        />
        <View className="flex-1 ml-4">
          <View className="flex-row items-center mb-1" style={{ gap: 7 }}>
            <Icon name={kickerIcon} size={15} color="#B4B4C2" />
            <Text
              className="text-ink-muted text-[10px] font-extrabold uppercase"
              style={{ letterSpacing: 1.4 }}
            >
              {kicker}
            </Text>
          </View>
          <View className="flex-row items-baseline">
            <Text className="text-ink font-display" style={{ fontSize: 30, lineHeight: 32 }}>
              {headline}
            </Text>
            {headlineUnit ? (
              <Text className="text-ink-muted text-sm font-bold ml-1">{headlineUnit}</Text>
            ) : null}
          </View>
          {sub ? <Text className="text-ink-subtle text-[12.5px] mt-1">{sub}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function HeroRing({
  pct,
  gradient,
  gradientId,
  size,
  centerValue,
  centerSub,
}: {
  pct: number;
  gradient: [string, string];
  gradientId: string;
  size: number;
  centerValue: string;
  centerSub: string;
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
          stroke="#21212B"
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
        <Text className="text-ink font-display" style={{ fontSize: 19, lineHeight: 21 }}>
          {centerValue}
        </Text>
        {centerSub ? (
          <Text className="text-ink-muted" style={{ fontSize: 9, fontWeight: '600' }}>
            {centerSub}
          </Text>
        ) : null}
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
}) {
  const pct = kcalTarget > 0 ? kcalEaten / kcalTarget : 0;
  const remaining = Math.max(0, kcalTarget - kcalEaten);
  return (
    <View>
      <HeroCard
        ringPct={pct}
        ringGradient={['#FF8A2B', '#FF4D2E']}
        ringGradientId="calRing"
        centerValue={String(kcalEaten)}
        centerSub={`/${kcalTarget}kcal`}
        kicker={t('home.calories', { defaultValue: 'Calories' })}
        kickerIcon="flame"
        headline={String(remaining)}
        headlineUnit="kcal"
        sub={`${remaining} ${t('home.remaining', { defaultValue: 'remaining' })} · ${t('home.onTrack', { defaultValue: 'on track' })}`}
      />
      <View className="flex-row mb-4" style={{ gap: 12 }}>
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
          gradient={['#F5C451', '#D97706']}
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
  stepsTarget,
  activeMinutesTarget,
  workoutsCount,
  workoutsMinutes,
  workoutsDistanceM,
  workoutsVolumeKg,
}: {
  t: Translate;
  steps: number;
  stepsTarget: number;
  activeMinutesTarget: number;
  workoutsCount: number;
  workoutsMinutes: number;
  workoutsDistanceM: number;
  workoutsVolumeKg: number;
}) {
  const stepsPct = stepsTarget > 0 ? steps / stepsTarget : 0;
  const remainingSteps = Math.max(0, stepsTarget - steps);
  const distanceKm = workoutsDistanceM / 1000;
  const distanceDisplay =
    distanceKm <= 0
      ? '0'
      : distanceKm < 10
        ? (Math.round(distanceKm * 10) / 10).toString()
        : Math.round(distanceKm).toString();
  // No GPS distance (no wearable) but there's lifted volume → show training
  // volume instead, which the app computes exactly from logged sets.
  const showVolume = distanceKm <= 0 && workoutsVolumeKg > 0;
  const volumeDisplay =
    workoutsVolumeKg >= 1000
      ? `${(Math.round(workoutsVolumeKg / 100) / 10).toString()}t`
      : workoutsVolumeKg.toLocaleString();
  return (
    <View>
      <HeroCard
        ringPct={stepsPct}
        ringGradient={['#2EE6A6', '#059669']}
        ringGradientId="stepsRing"
        centerValue={steps.toLocaleString()}
        centerSub={`/${stepsTarget.toLocaleString()}`}
        kicker={t('home.steps', { defaultValue: 'Steps' })}
        kickerIcon="bar-chart"
        headline={remainingSteps.toLocaleString()}
        headlineUnit={t('home.steps', { defaultValue: 'steps' })}
        sub={t('home.toDailyGoal', { defaultValue: 'to your daily goal' })}
      />
      <View className="flex-row mb-4" style={{ gap: 12 }}>
        <MacroCard
          value={workoutsMinutes}
          target={activeMinutesTarget}
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
          gradient={['#A78BFA', '#A855F7']}
          icon="medal"
        />
        {showVolume ? (
          <BiometricCard
            value={volumeDisplay}
            unit={workoutsVolumeKg >= 1000 ? '' : 'kg'}
            label={t('home.volume', { defaultValue: 'Volume' })}
            gradient={['#22D3EE', '#0891B2']}
            icon="dumbbell"
          />
        ) : (
          <BiometricCard
            value={distanceDisplay}
            unit={distanceKm > 0 ? 'km' : ''}
            label={t('home.distance', { defaultValue: 'Distance' })}
            gradient={['#22D3EE', '#0891B2']}
            icon="ruler"
          />
        )}
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
      style={[{ flex: 1, height: STAT_CARD_HEIGHT }, softShadow]}
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
            backgroundColor: '#21212B',
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

function DayRing({ value, active, dim }: { value: number; active: boolean; dim: boolean }) {
  const size = 38;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const done = pct >= 1;
  const trackColor = active ? '#34343F' : '#21212B';
  // Flame ring for completed/today; faint for future.
  const ringColor = '#FF4D2E';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
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
      {done ? (
        <Icon name="check" size={16} color="#FF4D2E" strokeWidth={3} />
      ) : dim ? (
        <View
          style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF4D2E', opacity: 0.5 }}
        />
      ) : null}
    </View>
  );
}

function MacroCard({
  value,
  target,
  label,
  gradient,
  gradientId,
  unit = 'g',
}: {
  value: number;
  target: number;
  label: string;
  gradient: [string, string];
  gradientId: string;
  icon?: IconName;
  unit?: string;
}) {
  const pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  return (
    <View
      className="bg-bg-subtle rounded-3xl p-3 border border-border items-center justify-center"
      style={[{ flex: 1, height: STAT_CARD_HEIGHT }, softShadow]}
    >
      <MacroArc pct={pct} gradient={gradient} gradientId={gradientId} size={62} />
      <View className="items-center mt-2.5">
        <Text className="text-ink font-display text-[13px]">
          {value}
          <Text className="text-ink-muted font-medium">
            /{target}
            {unit}
          </Text>
        </Text>
        <Text className="text-ink-muted text-[11px] mt-0.5" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function MacroArc({
  pct,
  gradient,
  gradientId,
  size,
}: {
  pct: number;
  gradient: [string, string];
  gradientId: string;
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
          stroke="#21212B"
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
        <Text className="text-ink font-display" style={{ fontSize: 14, lineHeight: 16 }}>
          {Math.round(pct * 100)}
          <Text className="text-ink-muted" style={{ fontSize: 9 }}>
            %
          </Text>
        </Text>
      </View>
    </View>
  );
}

function CTACard({
  gradient,
  glowColor,
  icon,
  kicker,
  title,
  sub,
  onPress,
}: {
  gradient: string[];
  glowColor: string;
  icon: IconName;
  kicker: string;
  title: string;
  sub: string;
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
    >
      <Animated.View
        className="rounded-2xl overflow-hidden mb-3"
        style={[
          animatedStyle,
          {
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 10,
          },
        ]}
      >
        <LinearGradient
          colors={gradient as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingVertical: 18, paddingHorizontal: 20 }}
        >
          {/* decorative blurred highlight */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -20,
              top: -20,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          />
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.20)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={24} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text
                className="text-white text-[10px] font-extrabold uppercase"
                style={{ letterSpacing: 1.4, opacity: 0.85 }}
                numberOfLines={1}
              >
                {kicker}
              </Text>
              <Text
                className="text-white font-display text-[19px]"
                style={{ lineHeight: 23, marginTop: 2 }}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text
                className="text-white text-[12.5px]"
                style={{ opacity: 0.9, marginTop: 2 }}
                numberOfLines={1}
              >
                {sub}
              </Text>
            </View>
            <Icon name="chevron-right" size={22} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function PowerMove({
  icon,
  gradient,
  title,
  sub,
  onPress,
}: {
  icon: IconName;
  gradient: [string, string];
  title: string;
  sub: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 20, stiffness: 400 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 20, stiffness: 400 }))}
      style={{ flex: 1 }}
    >
      <Animated.View
        className="bg-bg-subtle border border-border rounded-2xl"
        style={[animatedStyle, { padding: 14, height: 134 }, softShadow]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LinearGradient
            colors={gradient as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Icon name={icon} size={21} color="#FFFFFF" />
        </View>
        <View style={{ marginTop: 10 }}>
          <Text
            className="text-ink font-display text-[14px]"
            style={{ lineHeight: 17 }}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text className="text-ink-muted text-[11px] mt-0.5" numberOfLines={1}>
            {sub}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}
