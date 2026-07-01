import { useMemo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, Screen } from '@features/shared';
import type { IconName } from '@features/shared';
import { useWorkoutHistory } from '@features/workouts';
import { useProfile } from '@features/onboarding';

const monoFamily = 'SpaceGrotesk_700Bold';
const MS_PER_DAY = 86_400_000;
const WEEKS = 12;

export default function Progress() {
  const { t } = useTranslation();
  const router = useRouter();
  const history = useWorkoutHistory();
  const profile = useProfile();

  const stats = useMemo(() => buildStats(history.data ?? []), [history.data]);
  const weightUnit = profile.data?.weight_unit ?? 'kg';
  const weightDisplay = formatWeight(profile.data?.weight_kg, weightUnit);
  const heightDisplay = profile.data?.height_cm != null ? Math.round(profile.data.height_cm) : null;
  const totalVolDisplay =
    stats.totalVolumeKg > 0 ? formatNumber(convertKg(stats.totalVolumeKg, weightUnit)) : '0';
  const bestSessionDisplay =
    stats.bestSessionKg > 0 ? formatNumber(convertKg(stats.bestSessionKg, weightUnit)) : '—';

  const isLoading = history.isLoading || profile.isLoading;

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-2">
        {/* Header */}
        <View className="mb-7">
          <Text
            className="text-ink-muted text-[11px] font-extrabold uppercase mb-1.5"
            style={{ letterSpacing: 1.4 }}
          >
            {t('progress.kicker')}
          </Text>
          <Text className="text-ink text-3xl font-extrabold tracking-tight">
            {t('tabs.progress')}
          </Text>
        </View>

        {/* Headline stats — REAL */}
        <View className="flex-row mb-4" style={{ gap: 10 }}>
          <BigStat
            label={t('progress.totalVolume')}
            value={totalVolDisplay}
            unit={weightUnit}
            icon="trending"
            delta={stats.deltaLabel}
            deltaTone={stats.deltaTone}
          />
          <BigStat
            label={t('progress.bestLift', { defaultValue: 'Best session' })}
            value={bestSessionDisplay}
            unit={stats.bestSessionKg > 0 ? weightUnit : undefined}
            icon="medal"
            accent
          />
        </View>

        {/* Secondary stats — workouts + sets total */}
        <View className="flex-row mb-5" style={{ gap: 10 }}>
          <MiniStat
            icon="dumbbell"
            label={t('progress.workouts', { defaultValue: 'Workouts' })}
            value={String(stats.workoutCount)}
          />
          <MiniStat
            icon="calendar"
            label={t('progress.thisWeek', { defaultValue: 'This week' })}
            value={String(stats.thisWeekCount)}
          />
          <MiniStat
            icon="flame"
            label={t('progress.streak', { defaultValue: 'Streak' })}
            value={`${stats.streakDays}d`}
          />
        </View>

        {/* Strength level entry — links to the Strength screen */}
        <Pressable
          onPress={() => router.push('/strength')}
          className="rounded-3xl overflow-hidden mb-3 flex-row items-center"
          style={{
            backgroundColor: '#14141C',
            borderWidth: 1,
            borderColor: 'rgba(255,77,46,0.30)',
            padding: 16,
          }}
        >
          <View
            className="items-center justify-center overflow-hidden rounded-2xl mr-3"
            style={{ width: 44, height: 44 }}
          >
            <LinearGradient
              colors={['#FF8A2B', '#FF2D55'] as unknown as readonly [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <Icon name="medal" size={20} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-ink text-base font-extrabold tracking-tight">
              {t('strength.progressCard.title')}
            </Text>
            <Text className="text-ink-muted text-[12px] mt-0.5">
              {t('strength.progressCard.sub')}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color="#74748A" />
        </Pressable>

        {/* Volume chart — REAL, last 12 weeks */}
        <Panel className="mb-3">
          <View className="flex-row items-center justify-between mb-5">
            <View className="flex-1 pr-3">
              <Text
                className="text-ink-muted text-[10px] font-extrabold uppercase mb-1"
                style={{ letterSpacing: 1.4 }}
              >
                {t('progress.last12Weeks')}
              </Text>
              <Text className="text-ink text-lg font-extrabold tracking-tight">
                {t('progress.weeklyVolume')}
              </Text>
            </View>
            <DeltaPill value={stats.deltaLabel} tone={stats.deltaTone} />
          </View>

          <VolumeChart bars={stats.weeklyBars} />

          <View className="flex-row mt-2.5" style={{ gap: 6 }}>
            {stats.weeklyBars.map((_, i) => (
              <View key={i} className="flex-1 items-center">
                <Text
                  className="text-ink-muted text-[9px] font-bold"
                  style={{ letterSpacing: 0.4 }}
                >
                  W{i + 1}
                </Text>
              </View>
            ))}
          </View>

          {stats.totalVolumeKg === 0 && !isLoading ? (
            <Text
              className="text-ink-muted text-[11px] text-center mt-4"
              style={{ letterSpacing: 0.3 }}
            >
              {t('progress.noVolumeYet', {
                defaultValue: 'Finish a workout to see your weekly volume.',
              })}
            </Text>
          ) : null}
        </Panel>

        {/* Personal records */}
        <Panel className="mb-3">
          <View className="flex-row items-center mb-2">
            <IconBadge icon="medal" />
            <View className="flex-1">
              <Text
                className="text-ink-muted text-[10px] font-extrabold uppercase"
                style={{ letterSpacing: 1.4 }}
              >
                {t('progress.personalRecords')}
              </Text>
              <Text className="text-ink text-base font-extrabold mt-0.5 tracking-tight">
                {t('progress.noPRs')}
              </Text>
            </View>
          </View>
          <Text className="text-ink-subtle text-[13px] ml-[56px]" style={{ lineHeight: 18 }}>
            {t('progress.noPRBody')}
          </Text>
        </Panel>

        {/* Body — REAL from profile */}
        <Panel className="mb-3">
          <View className="flex-row items-center mb-4">
            <IconBadge icon="ruler" />
            <View className="flex-1">
              <Text
                className="text-ink-muted text-[10px] font-extrabold uppercase"
                style={{ letterSpacing: 1.4 }}
              >
                {t('progress.body')}
              </Text>
              <Text className="text-ink text-base font-extrabold mt-0.5 tracking-tight">
                {t('progress.measurements')}
              </Text>
            </View>
          </View>
          <View className="flex-row" style={{ gap: 10 }}>
            <BodyTile
              label={t('profile.stats.weight')}
              value={weightDisplay ?? '—'}
              unit={weightUnit}
            />
            <BodyTile
              label={t('profile.stats.height')}
              value={heightDisplay != null ? String(heightDisplay) : '—'}
              unit="cm"
            />
          </View>
        </Panel>

        <View style={{ height: 100 }} />
      </View>
    </Screen>
  );
}

/* ---------- Data derivation ---------- */

interface DerivedStats {
  totalVolumeKg: number;
  bestSessionKg: number;
  workoutCount: number;
  thisWeekCount: number;
  streakDays: number;
  weeklyBars: number[];
  deltaLabel: string;
  deltaTone: 'up' | 'down' | 'flat';
}

interface WorkoutLike {
  started_at: string;
  ended_at: string | null;
  total_volume_kg: number;
}

function buildStats(history: WorkoutLike[]): DerivedStats {
  const weeklyKg = new Array(WEEKS).fill(0) as number[];
  const now = new Date();
  const weekStart = startOfWeekSun(now);

  let totalVolumeKg = 0;
  let bestSessionKg = 0;

  for (const w of history) {
    const vol = Number(w.total_volume_kg) || 0;
    totalVolumeKg += vol;
    if (vol > bestSessionKg) bestSessionKg = vol;

    const started = new Date(w.started_at);
    const wsForWorkout = startOfWeekSun(started);
    const weeksAgo = Math.round((weekStart.getTime() - wsForWorkout.getTime()) / (7 * MS_PER_DAY));
    if (weeksAgo >= 0 && weeksAgo < WEEKS) {
      // weeklyBars[0] = oldest, weeklyBars[WEEKS-1] = current week
      const idx = WEEKS - 1 - weeksAgo;
      weeklyKg[idx] = (weeklyKg[idx] ?? 0) + vol;
    }
  }

  const max = Math.max(...weeklyKg, 1);
  const weeklyBars = weeklyKg.map((kg) => (kg / max) * 100);

  const thisWeek = weeklyKg[WEEKS - 1] ?? 0;
  const lastWeek = weeklyKg[WEEKS - 2] ?? 0;
  const { label: deltaLabel, tone: deltaTone } = computeDelta(thisWeek, lastWeek);

  // Workouts this week
  const thisWeekCount = history.filter((w) => {
    const started = new Date(w.started_at);
    return started.getTime() >= weekStart.getTime();
  }).length;

  // Streak: count consecutive days back from today with a workout
  const streakDays = computeStreak(history, now);

  return {
    totalVolumeKg,
    bestSessionKg,
    workoutCount: history.length,
    thisWeekCount,
    streakDays,
    weeklyBars,
    deltaLabel,
    deltaTone,
  };
}

function startOfWeekSun(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function computeDelta(
  current: number,
  previous: number,
): { label: string; tone: 'up' | 'down' | 'flat' } {
  if (previous === 0 && current === 0) return { label: '+0%', tone: 'flat' };
  if (previous === 0) return { label: 'NEW', tone: 'up' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: '+0%', tone: 'flat' };
  if (pct > 0) return { label: `+${pct}%`, tone: 'up' };
  return { label: `${pct}%`, tone: 'down' };
}

function computeStreak(history: WorkoutLike[], now: Date): number {
  if (history.length === 0) return 0;
  const days = new Set<number>();
  for (const w of history) {
    const d = new Date(w.started_at);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  }
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  // Allow today to be a rest day without breaking the streak
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function convertKg(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? kg * 2.20462 : kg;
}

function formatWeight(kg: number | null | undefined, unit: 'kg' | 'lb'): string | null {
  if (kg == null) return null;
  const v = convertKg(kg, unit);
  return v >= 100 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString();
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/* ---------- Panels ---------- */

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`rounded-3xl overflow-hidden ${className}`}
      style={{
        backgroundColor: '#14141C',
        borderWidth: 1,
        borderColor: '#21212B',
      }}
    >
      <View style={{ height: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1 }} />
        <View style={{ flex: 2, backgroundColor: '#FF4D2E33' }} />
        <View style={{ flex: 1 }} />
      </View>
      <View style={{ padding: 18 }}>{children}</View>
    </View>
  );
}

function IconBadge({ icon }: { icon: IconName }) {
  return (
    <View
      className="rounded-2xl items-center justify-center mr-3"
      style={{
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255,77,46,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,77,46,0.28)',
      }}
    >
      <Icon name={icon} size={20} color="#FF4D2E" />
    </View>
  );
}

/* ---------- Stats ---------- */

function BigStat({
  label,
  value,
  unit,
  icon,
  delta,
  deltaTone = 'flat',
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: IconName;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'flat';
  accent?: boolean;
}) {
  return (
    <View
      className="flex-1 rounded-3xl overflow-hidden"
      style={{
        backgroundColor: '#14141C',
        borderWidth: 1,
        borderColor: accent ? 'rgba(255,77,46,0.30)' : '#21212B',
      }}
    >
      <View style={{ height: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1 }} />
        <View style={{ flex: 2, backgroundColor: accent ? '#FF4D2E66' : '#FF4D2E33' }} />
        <View style={{ flex: 1 }} />
      </View>
      <View style={{ padding: 14 }}>
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-ink-muted text-[10px] font-extrabold uppercase flex-1"
            style={{ letterSpacing: 1.2 }}
            numberOfLines={1}
          >
            {label}
          </Text>
          <View
            className="items-center justify-center overflow-hidden"
            style={{ width: 32, height: 32, borderRadius: 10 }}
          >
            <LinearGradient
              colors={
                (accent ? ['#F5C451', '#FF8A2B'] : ['#FF8A2B', '#FF2D55']) as unknown as readonly [
                  string,
                  string,
                  ...string[],
                ]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <Icon name={icon} size={16} color="#FFFFFF" />
          </View>
        </View>
        <View className="flex-row items-baseline">
          <Text
            className="text-ink font-extrabold tracking-tight"
            style={{
              fontSize: 28,
              lineHeight: 32,
              fontFamily: monoFamily,
              fontVariant: ['tabular-nums'],
            }}
            numberOfLines={1}
          >
            {value}
          </Text>
          {unit ? <Text className="text-ink-muted text-sm font-bold ml-1">{unit}</Text> : null}
        </View>
        {delta ? (
          <View className="mt-2">
            <DeltaPill value={delta} tone={deltaTone} compact />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MiniStat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View
      className="flex-1 rounded-2xl px-3 py-3"
      style={{
        backgroundColor: '#14141C',
        borderWidth: 1,
        borderColor: '#21212B',
      }}
    >
      <View className="flex-row items-center mb-1.5" style={{ gap: 6 }}>
        <Icon name={icon} size={12} color="#B4B4C2" />
        <Text
          className="text-ink-muted text-[10px] font-extrabold uppercase"
          style={{ letterSpacing: 1 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        className="text-ink text-xl font-extrabold tracking-tight"
        style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

function DeltaPill({
  value,
  tone,
  compact = false,
}: {
  value: string;
  tone: 'up' | 'down' | 'flat';
  compact?: boolean;
}) {
  const color = tone === 'up' ? '#2EE6A6' : tone === 'down' ? '#FF4D6D' : '#B4B4C2';
  const bg =
    tone === 'up'
      ? 'rgba(52,211,153,0.12)'
      : tone === 'down'
        ? 'rgba(248,113,113,0.12)'
        : 'rgba(161,161,170,0.10)';
  const border =
    tone === 'up'
      ? 'rgba(52,211,153,0.30)'
      : tone === 'down'
        ? 'rgba(248,113,113,0.30)'
        : 'rgba(161,161,170,0.22)';
  return (
    <View
      className="self-start rounded-full"
      style={{
        paddingHorizontal: compact ? 7 : 10,
        paddingVertical: compact ? 2 : 3,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text className="text-[10px] font-extrabold uppercase" style={{ color, letterSpacing: 1 }}>
        {value}
      </Text>
    </View>
  );
}

/* ---------- Volume chart ---------- */

function VolumeChart({ bars }: { bars: number[] }) {
  // Area + line chart (Sahha design). `bars` are 0–100 normalized values.
  const W = 320;
  const H = 140;
  const pad = 6;
  const allZero = bars.every((b) => b === 0);
  const data = bars.length ? bars : [0, 0];
  const n = data.length;
  const bw = (W - pad * 2) / n;
  const pts = data.map((v, i) => {
    const x = pad + bw * i + bw / 2;
    const clamped = Math.max(0, Math.min(100, v));
    const y = H - pad - (clamped / 100) * (H - pad * 2 - 8);
    return [x, y] as const;
  });
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const area = `${line} L${last[0].toFixed(1)} ${H} L${first[0].toFixed(1)} ${H} Z`;

  return (
    <View style={{ height: H }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <SvgGradient id="volArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF7A1A" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#FF2D55" stopOpacity={0} />
          </SvgGradient>
          <SvgGradient id="volLine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FF8A2B" />
            <Stop offset="1" stopColor="#FF2D55" />
          </SvgGradient>
        </Defs>
        {!allZero ? <Path d={area} fill="url(#volArea)" /> : null}
        <Path
          d={line}
          fill="none"
          stroke="url(#volLine)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={allZero ? 0.3 : 1}
        />
        {!allZero ? (
          <>
            <Circle cx={last[0]} cy={last[1]} r={9} fill="#FF2D55" opacity={0.25} />
            <Circle
              cx={last[0]}
              cy={last[1]}
              r={4}
              fill="#FFFFFF"
              stroke="#FF2D55"
              strokeWidth={2}
            />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

/* ---------- Body tile ---------- */

function BodyTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View
      className="flex-1 rounded-2xl px-3.5 py-3.5"
      style={{
        backgroundColor: '#1B1B25',
        borderWidth: 1,
        borderColor: '#21212B',
      }}
    >
      <Text
        className="text-ink-muted text-[10px] font-extrabold uppercase mb-1.5"
        style={{ letterSpacing: 1.2 }}
      >
        {label}
      </Text>
      <View className="flex-row items-baseline">
        <Text
          className="text-ink text-2xl font-extrabold tracking-tight"
          style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
        <Text className="text-ink-muted text-xs ml-1 font-bold">{unit}</Text>
      </View>
    </View>
  );
}
