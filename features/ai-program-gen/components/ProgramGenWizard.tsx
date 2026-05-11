/* eslint-disable max-lines */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { Keyboard, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Header, Icon, Screen } from '@features/shared';
import type { IconName } from '@features/shared';
import { useHasProgram } from '@features/ai-program-adjust';
import { useGenerateProgram } from '@features/ai-routine-gen';
import { useProfile } from '@features/onboarding';
import type { GenerateProgramRequest } from '@lib/llm';

type Goal = GenerateProgramRequest['goal'];
type Exp = GenerateProgramRequest['experience'];
type Eq = GenerateProgramRequest['equipment'];
type Days = GenerateProgramRequest['days_per_week'];
type Weeks = GenerateProgramRequest['weeks'];

const ACCENT = '#F97316';
const ACCENT_LIGHT = '#FB923C';
const ACCENT_DEEP = '#FF4D2E';

export function ProgramGenWizard() {
  const { t } = useTranslation();
  const profile = useProfile();
  const hasProgram = useHasProgram();
  const { generate, loading, errorCode } = useGenerateProgram();

  const [weeks, setWeeks] = useState<Weeks>(8);
  const [preferences, setPreferences] = useState('');

  // If a program already exists, bounce to home — this is a one-time quiz.
  useEffect(() => {
    if (hasProgram.data === true) router.replace('/(tabs)');
  }, [hasProgram.data]);

  const params = useMemo(() => deriveParamsFromProfile(profile.data), [profile.data]);

  const onGenerate = async () => {
    Keyboard.dismiss();
    try {
      await generate({
        goal: params.goal,
        experience: params.experience,
        days_per_week: params.days,
        equipment: params.equipment,
        weeks,
        preferences: preferences.trim() || undefined,
      });
      router.replace('/routines/generate-program/preview');
    } catch {
      /* surfaced via errorCode */
    }
  };

  if (loading) return <PremiumLoader />;

  return (
    <Screen scroll padded={false} glow keyboardShouldPersistTaps="always">
      <Header title={t('ai.program.title', 'Build your program')} showBack />

      <View className="px-5 pt-2">
        {/* Hero */}
        <Animated.View entering={FadeIn.duration(280)} className="mt-2 mb-5">
          <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: ACCENT,
              }}
            />
            <Text
              className="text-[10px] font-extrabold uppercase"
              style={{ color: ACCENT, letterSpacing: 1.4 }}
            >
              {t('ai.program.kicker', 'AI Coach · Personalized')}
            </Text>
          </View>
          <Text className="text-ink text-[28px] font-extrabold tracking-tight leading-9">
            {t('ai.program.heroTitle', 'Your program, ready in seconds.')}
          </Text>
          <Text className="text-ink-subtle text-[14px] mt-2 leading-5">
            {t(
              'ai.program.heroSub',
              "We'll use what you already told us. Pick a length and we'll handle the rest.",
            )}
          </Text>
        </Animated.View>

        {/* Profile summary card */}
        <Animated.View entering={FadeIn.duration(320).delay(60)}>
          <ProfileCard params={params} loading={profile.isLoading} />
        </Animated.View>

        {/* Length selector */}
        <Animated.View entering={FadeIn.duration(320).delay(120)}>
          <SectionLabel>{t('ai.program.lengthLabel', 'Program length')}</SectionLabel>
          <View className="flex-row" style={{ gap: 10 }}>
            {[4, 8, 12].map((w) => (
              <WeeksTile
                key={w}
                active={weeks === w}
                weeks={w as Weeks}
                onPress={() => setWeeks(w as Weeks)}
                suffix={t('ai.program.weeksSuffix', 'weeks')}
              />
            ))}
          </View>
        </Animated.View>

        {/* Notes */}
        <Animated.View entering={FadeIn.duration(320).delay(180)}>
          <SectionLabel>
            {t('ai.program.notesLabel', 'Anything to consider?')}
            <Text className="text-ink-muted text-[10px] font-bold ml-2 normal-case">
              · {t('common.optional', 'Optional')}
            </Text>
          </SectionLabel>
          <View
            className="bg-bg-raised border border-border rounded-2xl px-4 py-3"
            style={{ minHeight: 96 }}
          >
            <TextInput
              value={preferences}
              onChangeText={setPreferences}
              placeholder={t(
                'ai.program.notesPlaceholder',
                'e.g. avoid deadlifts, prefer mornings, focus on shoulders',
              )}
              placeholderTextColor="#71717A"
              className="text-ink text-base"
              multiline
              style={{ minHeight: 76, textAlignVertical: 'top' }}
            />
          </View>
        </Animated.View>

        {errorCode ? <ErrorBanner code={errorCode} onRetry={() => onGenerate()} /> : null}

        <View className="h-6" />

        <PrimaryAction
          label={t('ai.program.generateNow', 'Generate my program')}
          icon="sparkles"
          onPress={onGenerate}
        />

        <Text className="text-ink-muted text-[11px] text-center mt-3">
          {t('ai.program.takesSeconds', 'Usually takes 5–15 seconds')}
        </Text>

        <View style={{ height: 32 }} />
      </View>
    </Screen>
  );
}

// -- Helpers --------------------------------------------------------------

interface DerivedParams {
  goal: Goal;
  experience: Exp;
  days: Days;
  equipment: Eq;
}

function deriveParamsFromProfile(
  p:
    | {
        goal?: string | null;
        experience_level?: string | null;
        training_days_per_week?: number | null;
        equipment_access?: string | null;
      }
    | null
    | undefined,
): DerivedParams {
  // Always return a usable params object — fall back to sensible defaults when
  // the profile hasn't loaded or onboarding skipped a field. Otherwise the
  // Generate button would be disabled with no explanation to the user.
  const goal: Goal = p?.goal === 'strength' || p?.goal === 'recomp' ? p.goal : 'hypertrophy';
  const experience: Exp =
    p?.experience_level === 'beginner' || p?.experience_level === 'advanced'
      ? p.experience_level
      : 'intermediate';
  const rawDays = p?.training_days_per_week ?? 4;
  const days = Math.max(3, Math.min(6, rawDays)) as Days;
  const eqMap: Record<string, Eq> = {
    full_gym: 'full_gym',
    home_gym: 'home_dumbbells',
    minimal: 'minimal',
  };
  const equipment: Eq = (p?.equipment_access && eqMap[p.equipment_access]) || 'full_gym';
  return { goal, experience, days, equipment };
}

// -- UI building blocks ---------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="text-ink-muted text-[10px] font-extrabold uppercase mt-5 mb-2.5"
      style={{ letterSpacing: 1.2 }}
    >
      {children}
    </Text>
  );
}

function ProfileCard({ params, loading }: { params: DerivedParams; loading: boolean }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View
        className="rounded-2xl"
        style={{
          padding: 16,
          minHeight: 110,
          backgroundColor: '#17171B',
          borderWidth: 1,
          borderColor: '#27272F',
        }}
      >
        <ShimmerLine width={120} />
        <View style={{ height: 12 }} />
        <ShimmerLine width={220} />
      </View>
    );
  }

  const goalLabel = t(`ai.program.goals.${params.goal}`);
  const expLabel = t(`ai.program.exps.${params.experience}`);
  const eqLabel = t(`ai.program.eqs.${params.equipment}`);
  const daysLabel = `${params.days} ${t('ai.program.daysSuffix', 'days')}`;

  const rows: { icon: IconName; label: string; value: string }[] = [
    { icon: 'target', label: t('ai.program.goal', 'Goal'), value: goalLabel },
    { icon: 'trending', label: t('ai.program.experience', 'Experience'), value: expLabel },
    { icon: 'calendar', label: t('ai.program.days', 'Schedule'), value: daysLabel },
    { icon: 'dumbbell', label: t('ai.program.equipment', 'Equipment'), value: eqLabel },
  ];

  return (
    <View
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.22)',
      }}
    >
      <LinearGradient
        colors={['rgba(249,115,22,0.10)', 'rgba(23,23,27,1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 16 }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-[10px] font-extrabold uppercase"
            style={{ color: ACCENT, letterSpacing: 1.2 }}
          >
            {t('ai.program.fromProfile', 'From your profile')}
          </Text>
          <Pressable onPress={() => router.push('/edit-profile')} hitSlop={10}>
            <Text className="text-accent text-[11px] font-bold">{t('common.edit', 'Edit')}</Text>
          </Pressable>
        </View>

        <View style={{ gap: 12 }}>
          {rows.map((r) => (
            <View key={r.label} className="flex-row items-center" style={{ gap: 12 }}>
              <View
                className="rounded-xl items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: 'rgba(249,115,22,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(249,115,22,0.28)',
                }}
              >
                <Icon name={r.icon} size={15} color={ACCENT} />
              </View>
              <Text
                className="text-ink-muted text-[11px] font-bold uppercase flex-1"
                style={{ letterSpacing: 1 }}
              >
                {r.label}
              </Text>
              <Text className="text-ink text-[14px] font-extrabold tracking-tight">{r.value}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

function ShimmerLine({ width }: { width: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
  }, [v]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.45 * Math.abs(Math.sin(v.value * Math.PI)),
  }));
  return (
    <Animated.View
      style={[style, { width, height: 12, borderRadius: 6, backgroundColor: '#27272F' }]}
    />
  );
}

function WeeksTile({
  weeks,
  active,
  onPress,
  suffix,
}: {
  weeks: Weeks;
  active: boolean;
  onPress: () => void;
  suffix: string;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 18, stiffness: 380 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 380 }))}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          animated,
          {
            borderRadius: 18,
            paddingVertical: 16,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: active ? ACCENT : '#27272F',
            backgroundColor: active ? 'rgba(249,115,22,0.10)' : '#17171B',
          },
        ]}
      >
        <Text
          className="font-extrabold tracking-tight"
          style={{
            fontSize: 28,
            lineHeight: 32,
            color: active ? ACCENT : '#F4F4F5',
          }}
        >
          {weeks}
        </Text>
        <Text
          className="text-ink-muted text-[10px] font-bold uppercase mt-0.5"
          style={{ letterSpacing: 1 }}
        >
          {suffix}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function PrimaryAction({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  // TouchableOpacity is RN's most permissive press wrapper — works through any
  // ScrollView keyboard config and never gets confused by inner styled views.
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
      accessibilityRole="button"
      style={{
        borderRadius: 999,
        opacity: disabled ? 0.55 : 1,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: disabled ? 0 : 0.42,
        shadowRadius: 24,
        elevation: disabled ? 0 : 10,
      }}
    >
      <View style={{ borderRadius: 999, overflow: 'hidden' }}>
        <LinearGradient
          colors={
            [ACCENT_DEEP, ACCENT, ACCENT_LIGHT] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 18,
            paddingHorizontal: 22,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                marginRight: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.20)',
              }}
            >
              <Icon name={icon} size={14} color="#FFFFFF" />
            </View>
          ) : null}
          <Text className="text-white font-extrabold" style={{ fontSize: 16, letterSpacing: 0.2 }}>
            {label}
          </Text>
          <View style={{ marginLeft: 10, opacity: 0.9 }}>
            <Icon name="chevron-right" size={16} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

function ErrorBanner({ code: _code, onRetry }: { code: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      className="mt-4 p-4 rounded-2xl flex-row items-center"
      style={{
        gap: 12,
        backgroundColor: 'rgba(255, 77, 46, 0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255, 77, 46, 0.45)',
      }}
    >
      <Icon name="alert" size={18} color="#FF4D2E" />
      <Text className="flex-1 text-ink text-[13px] font-bold">
        {t('ai.program.errorBody', "Couldn't build your program. Tap retry.")}
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 10,
          backgroundColor: 'rgba(255,77,46,0.16)',
          borderWidth: 1,
          borderColor: 'rgba(255,77,46,0.45)',
          gap: 5,
        }}
      >
        <Icon name="zap" size={12} color="#FF4D2E" />
        <Text className="text-[12px] font-extrabold" style={{ color: '#FF4D2E' }}>
          {t('common.retry', 'Retry')}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// -- Premium loader -------------------------------------------------------

const LOADING_MESSAGE_KEYS = [
  'ai.program.loadingMessages.designing',
  'ai.program.loadingMessages.picking',
  'ai.program.loadingMessages.balancing',
  'ai.program.loadingMessages.spreading',
  'ai.program.loadingMessages.rest',
  'ai.program.loadingMessages.almost',
] as const;

function PremiumLoader() {
  const { t } = useTranslation();
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % LOADING_MESSAGE_KEYS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen padded={false} glow>
      <View className="flex-1 items-center justify-center px-8">
        <OrbitalSpinner />
        <View style={{ height: 36 }} />
        <View style={{ minHeight: 60, alignItems: 'center' }}>
          <Animated.View key={LOADING_MESSAGE_KEYS[i]} entering={FadeIn.duration(360)}>
            <Text className="text-ink text-[18px] font-extrabold tracking-tight text-center">
              {t(LOADING_MESSAGE_KEYS[i]!)}
            </Text>
          </Animated.View>
          <Text className="text-ink-subtle text-[13px] mt-2 text-center">
            {t('ai.program.loadingTakesSeconds', 'This usually takes a few seconds.')}
          </Text>
        </View>
        <View style={{ height: 32 }} />
        <ProgressSweep />
        <StepDotsRow current={i} total={LOADING_MESSAGE_KEYS.length} />
      </View>
    </Screen>
  );
}

// Three concentric rings + a pulsing core. Pure Reanimated worklets, no images.
function OrbitalSpinner() {
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    ring1.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
    ring2.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1, false);
    ring3.value = withRepeat(withTiming(1, { duration: 4600, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(ring1);
      cancelAnimation(ring2);
      cancelAnimation(ring3);
      cancelAnimation(pulse);
    };
  }, [ring1, ring2, ring3, pulse]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring1.value * 360}deg` }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-ring2.value * 360}deg` }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring3.value * 360}deg` }],
  }));
  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.08], Extrapolation.CLAMP) }],
    opacity: interpolate(pulse.value, [0, 1], [0.78, 1], Extrapolation.CLAMP),
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.18, 0.42], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.18], Extrapolation.CLAMP) }],
  }));

  return (
    <View
      style={{
        width: 160,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* halo glow */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: ACCENT,
          },
          haloStyle,
        ]}
      />
      {/* ring 3 — outermost, slowest */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 156,
            height: 156,
            borderRadius: 78,
            borderWidth: 1.5,
            borderColor: 'rgba(249,115,22,0.18)',
            borderTopColor: 'rgba(249,115,22,0.65)',
            borderRightColor: 'rgba(249,115,22,0.18)',
          },
          ring3Style,
        ]}
      />
      {/* ring 2 — middle, reverse direction */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 124,
            height: 124,
            borderRadius: 62,
            borderWidth: 2,
            borderColor: 'rgba(251,146,60,0.14)',
            borderTopColor: 'rgba(251,146,60,0.55)',
            borderLeftColor: 'rgba(251,146,60,0.32)',
          },
          ring2Style,
        ]}
      />
      {/* ring 1 — innermost, fastest */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 92,
            height: 92,
            borderRadius: 46,
            borderWidth: 2.5,
            borderColor: 'rgba(255,77,46,0.18)',
            borderTopColor: ACCENT_DEEP,
            borderRightColor: ACCENT,
          },
          ring1Style,
        ]}
      />
      {/* core gradient pulse */}
      <Animated.View
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            overflow: 'hidden',
            shadowColor: ACCENT,
            shadowOpacity: 0.45,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 0 },
          },
          coreStyle,
        ]}
      >
        <LinearGradient
          colors={
            [ACCENT_DEEP, ACCENT, ACCENT_LIGHT] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="sparkles" size={22} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// Indeterminate progress sweep — gradient slides across a track.
function ProgressSweep() {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
    return () => cancelAnimation(v);
  }, [v]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(v.value, [0, 1], [-160, 220]) }],
  }));

  return (
    <View
      style={{
        width: 220,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ width: 120, height: 4 }, style]}>
        <LinearGradient
          colors={
            ['transparent', ACCENT_DEEP, ACCENT_LIGHT, 'transparent'] as unknown as readonly [
              string,
              string,
              ...string[],
            ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 2 }}
        />
      </Animated.View>
    </View>
  );
}

function StepDotsRow({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row mt-5" style={{ gap: 6 }}>
      {Array.from({ length: total }).map((_, idx) => (
        <Dot key={idx} active={idx === current} done={idx < current} />
      ))}
    </View>
  );
}

function Dot({ active, done }: { active: boolean; done: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(active ? 1 : 0, { duration: 320 });
  }, [active, v]);
  const style = useAnimatedStyle(() => ({
    width: interpolate(v.value, [0, 1], [6, 22]),
    opacity: done ? 0.55 : 1,
  }));
  return (
    <Animated.View
      style={[
        {
          height: 6,
          borderRadius: 3,
          backgroundColor: active || done ? ACCENT : '#27272F',
        },
        style,
      ]}
    />
  );
}
