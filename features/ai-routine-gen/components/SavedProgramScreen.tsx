/* eslint-disable max-lines */
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Header, Icon, Screen, Spinner } from '@features/shared';
import type { IconName } from '@features/shared';
import { useDraftRoutineStore } from '../store';
import { useSavedProgram } from '../hooks/useSavedProgram';
import { exerciseImageUrl } from '../data/exerciseLookup';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';

const ACCENT = '#F97316';

const MUSCLE_COLORS: Record<string, { from: string; to: string; icon: IconName }> = {
  chest: { from: '#EF4444', to: '#F87171', icon: 'flame' },
  back: { from: '#3B82F6', to: '#60A5FA', icon: 'trending' },
  shoulders: { from: '#F59E0B', to: '#FBBF24', icon: 'zap' },
  'rear delts': { from: '#F97316', to: '#FB923C', icon: 'zap' },
  biceps: { from: '#8B5CF6', to: '#A78BFA', icon: 'dumbbell' },
  triceps: { from: '#A855F7', to: '#C084FC', icon: 'dumbbell' },
  arms: { from: '#8B5CF6', to: '#C084FC', icon: 'dumbbell' },
  quads: { from: '#10B981', to: '#34D399', icon: 'target' },
  hamstrings: { from: '#14B8A6', to: '#2DD4BF', icon: 'target' },
  glutes: { from: '#EC4899', to: '#F472B6', icon: 'heart' },
  calves: { from: '#06B6D4', to: '#22D3EE', icon: 'arrow-up' },
  traps: { from: '#64748B', to: '#94A3B8', icon: 'arrow-up' },
  core: { from: '#84CC16', to: '#A3E635', icon: 'target' },
};
const FALLBACK_COLOR = { from: '#52525B', to: '#71717A', icon: 'dumbbell' as IconName };
const colorFor = (m?: string) => (m && MUSCLE_COLORS[m.toLowerCase()]) || FALLBACK_COLOR;

type ProgramExercise = {
  name: string;
  muscle_group?: string;
  sets: number;
  reps: string;
  rpe?: number;
  rest_seconds: number;
};

export function SavedProgramScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const saved = useSavedProgram(id);
  const setProgram = useDraftRoutineStore((s) => s.setProgram);
  const [activeWeek, setActiveWeek] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState<ProgramExercise | null>(null);

  // Load the saved program into the draft store so the existing
  // walkthrough screen can read from it.
  useEffect(() => {
    if (saved.data) {
      setProgram(saved.data.program, {
        goal: saved.data.goal ?? 'hypertrophy',
        weeks: saved.data.program.weeks,
        days_per_week: saved.data.program.days_per_week,
      });
    }
  }, [saved.data, setProgram]);

  const program = saved.data?.program;
  const weeks = useMemo(() => {
    if (!program) return [];
    const setW = new Set<number>();
    program.days.forEach((d) => setW.add(d.week));
    return Array.from(setW).sort((a, b) => a - b);
  }, [program]);

  if (saved.isLoading || !program) {
    return (
      <Screen>
        <Header title={t('routines.yourProgram')} showBack />
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Screen>
    );
  }

  const totalSessions = program.days.length;
  const totalExercises =
    program.days.filter((d) => d.week === 1).reduce((acc, d) => acc + d.exercises.length, 0) ?? 0;

  const daysInWeek = program.days
    .filter((d) => d.week === activeWeek)
    .sort((a, b) => a.day_index - b.day_index);

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-4">
        <Header title={t('routines.yourProgram')} showBack />
      </View>

      <View className="px-5">
        {/* Hero */}
        <View
          className="rounded-3xl overflow-hidden mb-4"
          style={{
            shadowColor: ACCENT,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
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
                {t('routines.activeProgram')}
              </Text>
            </View>
            <Text
              className="text-white font-extrabold tracking-tight"
              style={{ fontSize: 24, lineHeight: 28 }}
              numberOfLines={2}
            >
              {program.name}
            </Text>
            <View className="flex-row mt-4" style={{ gap: 8 }}>
              <Stat label={t('routines.weeks')} value={String(program.weeks)} />
              <Stat label={t('routines.daysPerWeek')} value={String(program.days_per_week)} />
              <Stat label={t('routines.exercises')} value={String(totalExercises)} />
              <Stat label={t('routines.sessions')} value={String(totalSessions)} />
            </View>
          </LinearGradient>
        </View>

        {/* AI reasoning */}
        {program.program_reasoning ? (
          <View
            className="rounded-2xl border mb-4"
            style={{
              backgroundColor: '#17171B',
              borderColor: 'rgba(249,115,22,0.25)',
              padding: 14,
            }}
          >
            <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
              <View
                className="rounded-full items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  backgroundColor: 'rgba(249,115,22,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(249,115,22,0.3)',
                }}
              >
                <Icon name="sparkles" size={14} color={ACCENT} />
              </View>
              <Text
                className="text-[10px] font-extrabold uppercase"
                style={{ color: ACCENT, letterSpacing: 1.2 }}
              >
                {t('routines.coachNotes')}
              </Text>
            </View>
            <Text className="text-ink-subtle text-[13px]" style={{ lineHeight: 19 }}>
              {program.program_reasoning}
            </Text>
          </View>
        ) : null}

        {/* Week selector */}
        <Text
          className="text-ink-muted text-[10px] font-extrabold uppercase mb-2"
          style={{ letterSpacing: 1.2 }}
        >
          {t('routines.selectWeek')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          className="mb-5"
        >
          {weeks.map((w) => (
            <WeekPill
              key={w}
              active={w === activeWeek}
              week={w}
              isDeload={w % 4 === 0 && program.weeks >= 4}
              onPress={() => setActiveWeek(w)}
            />
          ))}
        </ScrollView>

        {/* Day cards */}
        <Animated.View key={`week-${activeWeek}`} entering={FadeIn.duration(200)}>
          {daysInWeek.map((d, idx) => (
            <DayCard
              key={`${d.week}-${d.day_index}`}
              day={d}
              dayNumber={idx + 1}
              defaultOpen={idx === 0}
              onSelectExercise={setSelectedExercise}
              onStart={() =>
                router.push(
                  `/routines/generate-program/walkthrough?week=${d.week}&day=${d.day_index}` as never,
                )
              }
            />
          ))}
        </Animated.View>

        {/* Sheet */}
        <ExerciseDetailSheet
          visible={!!selectedExercise}
          onClose={() => setSelectedExercise(null)}
          exercise={selectedExercise}
          accentColor={selectedExercise ? colorFor(selectedExercise.muscle_group).from : ACCENT}
        />

        <View style={{ height: 32 }} />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="rounded-xl"
      style={{
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 8,
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

function WeekPill({
  active,
  week,
  onPress,
  isDeload,
}: {
  active: boolean;
  week: number;
  onPress: () => void;
  isDeload: boolean;
}) {
  const { t } = useTranslation();
  const weekLabel = t('routines.weekN', { n: week });
  if (active) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={['#FF4D2E', '#F97316'] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 999,
          }}
        >
          <Text className="text-white text-[12px] font-extrabold tracking-tight">
            {weekLabel}
            {isDeload ? ` · ${t('routines.deload')}` : ''}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 999,
        backgroundColor: '#17171B',
        borderWidth: 1,
        borderColor: '#27272F',
      }}
    >
      <Text className="text-ink-muted text-[12px] font-bold tracking-tight">{weekLabel}</Text>
    </Pressable>
  );
}

function DayCard({
  day,
  dayNumber,
  defaultOpen,
  onSelectExercise,
  onStart,
}: {
  day: { week: number; day_index: number; name: string; exercises: ProgramExercise[] };
  dayNumber: number;
  defaultOpen?: boolean;
  onSelectExercise?: (ex: ProgramExercise) => void;
  onStart?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(!!defaultOpen);
  const muscles = useMemo(() => {
    const set = new Set<string>();
    day.exercises.forEach((e) => {
      if (e.muscle_group) set.add(e.muscle_group);
    });
    return Array.from(set).slice(0, 4);
  }, [day]);

  const totalSets = day.exercises.reduce((s, e) => s + e.sets, 0);
  const estMinutes = Math.round(
    day.exercises.reduce((s, e) => s + e.sets * (e.rest_seconds + 30), 0) / 60,
  );

  const dominantMuscle = day.exercises[0]?.muscle_group ?? muscles[0];
  const dayColor = colorFor(dominantMuscle);

  return (
    <Pressable onPress={() => setOpen((o) => !o)} className="mb-2.5">
      <View
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#17171B',
          borderWidth: 1,
          borderColor: open ? `${dayColor.from}50` : '#27272F',
        }}
      >
        {open ? (
          <LinearGradient
            colors={
              ['transparent', dayColor.from, 'transparent'] as unknown as readonly [
                string,
                string,
                ...string[],
              ]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 1.5 }}
          />
        ) : null}

        <View className="flex-row items-center p-3">
          <LinearGradient
            colors={
              [dayColor.from, dayColor.to] as unknown as readonly [string, string, ...string[]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text className="text-white font-extrabold tracking-tight" style={{ fontSize: 14 }}>
              D{dayNumber}
            </Text>
          </LinearGradient>

          <View className="flex-1">
            <Text className="text-ink text-[15px] font-extrabold tracking-tight" numberOfLines={1}>
              {day.name}
            </Text>
            <View className="flex-row items-center mt-1" style={{ gap: 6, flexWrap: 'wrap' }}>
              <MetaChip
                icon="dumbbell"
                label={t('routines.exShort', { count: day.exercises.length })}
              />
              <MetaChip icon="bar-chart" label={t('routines.setsLabel', { count: totalSets })} />
              {estMinutes > 0 ? (
                <MetaChip icon="clock" label={t('routines.minLabel', { count: estMinutes })} />
              ) : null}
            </View>
          </View>

          <View
            className="rounded-full items-center justify-center ml-2"
            style={{
              width: 26,
              height: 26,
              backgroundColor: open ? `${dayColor.from}1F` : 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: open ? `${dayColor.from}30` : '#27272F',
            }}
          >
            <Icon
              name={open ? 'chevron-down' : 'chevron-right'}
              size={13}
              color={open ? dayColor.from : '#A1A1AA'}
            />
          </View>
        </View>

        {muscles.length > 0 ? (
          <View className="flex-row px-3 pb-3" style={{ gap: 6, flexWrap: 'wrap' }}>
            {muscles.map((m) => {
              const c = colorFor(m);
              return (
                <View
                  key={m}
                  className="rounded-full px-2"
                  style={{
                    paddingVertical: 2,
                    backgroundColor: `${c.from}1F`,
                    borderWidth: 1,
                    borderColor: `${c.from}40`,
                  }}
                >
                  <Text
                    className="text-[9px] font-extrabold uppercase"
                    style={{ color: c.from, letterSpacing: 0.6 }}
                  >
                    {m}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {open ? (
          <View className="px-3 pb-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: '#27272F' }}>
            {day.exercises.map((ex, i) => (
              <ExerciseRow
                key={`${ex.name}-${i}`}
                ex={ex}
                index={i + 1}
                onPress={() => onSelectExercise?.(ex)}
              />
            ))}

            {onStart ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onStart();
                }}
                style={{
                  marginTop: 8,
                  borderRadius: 14,
                  overflow: 'hidden',
                  shadowColor: dayColor.from,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                }}
              >
                <LinearGradient
                  colors={
                    [dayColor.from, dayColor.to] as unknown as readonly [
                      string,
                      string,
                      ...string[],
                    ]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Icon name="play" size={14} color="#FFFFFF" />
                  <Text
                    className="text-white font-extrabold tracking-tight"
                    style={{ fontSize: 14 }}
                  >
                    {t('routines.startWorkout')}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function ExerciseRow({
  ex,
  index,
  onPress,
}: {
  ex: ProgramExercise;
  index: number;
  onPress?: () => void;
}) {
  const c = colorFor(ex.muscle_group);
  const imageUrl = exerciseImageUrl(ex.name);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!imageUrl && !imgFailed;

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress?.();
      }}
      className="flex-row items-center py-2"
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          overflow: 'hidden',
          marginRight: 10,
          backgroundColor: '#0B0B0F',
          borderWidth: 1,
          borderColor: `${c.from}40`,
        }}
      >
        {showImage ? (
          <Image
            source={{ uri: imageUrl as string }}
            onError={() => setImgFailed(true)}
            resizeMode="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <LinearGradient
            colors={[c.from, c.to] as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={c.icon} size={22} color="#FFFFFF" />
          </LinearGradient>
        )}
        <View
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            backgroundColor: 'rgba(0,0,0,0.55)',
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 5,
          }}
        >
          <Text className="text-white font-extrabold" style={{ fontSize: 9 }}>
            {index}
          </Text>
        </View>
      </View>

      <View className="flex-1 mr-2">
        <Text className="text-ink text-[13px] font-bold tracking-tight" numberOfLines={1}>
          {ex.name}
        </Text>
        {ex.muscle_group ? (
          <Text
            className="text-[10px] font-bold uppercase mt-0.5"
            style={{ color: c.from, letterSpacing: 0.6 }}
          >
            {ex.muscle_group}
          </Text>
        ) : null}
      </View>

      <View className="items-end" style={{ gap: 3 }}>
        <Pill color={c.from}>{`${ex.sets}×${ex.reps}`}</Pill>
        <View className="flex-row" style={{ gap: 3 }}>
          {ex.rpe ? <Pill>{`RPE ${ex.rpe}`}</Pill> : null}
          <Pill>{`${ex.rest_seconds}s`}</Pill>
        </View>
      </View>

      <View
        className="ml-2 rounded-full items-center justify-center"
        style={{
          width: 22,
          height: 22,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: '#27272F',
        }}
      >
        <Icon name="chevron-right" size={11} color="#A1A1AA" />
      </View>
    </Pressable>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <View
      className="rounded-md"
      style={{
        paddingHorizontal: 6,
        paddingVertical: 3,
        backgroundColor: color ? `${color}1A` : 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: color ? `${color}40` : '#27272F',
      }}
    >
      <Text
        className="font-extrabold"
        style={{
          fontSize: 10,
          color: color ?? '#A1A1AA',
          letterSpacing: 0.3,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function MetaChip({ icon, label }: { icon: 'dumbbell' | 'bar-chart' | 'clock'; label: string }) {
  return (
    <View
      className="flex-row items-center rounded-full"
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: '#27272F',
        gap: 4,
      }}
    >
      <Icon name={icon} size={9} color="#A1A1AA" />
      <Text className="text-ink-muted text-[9px] font-bold" style={{ letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}
