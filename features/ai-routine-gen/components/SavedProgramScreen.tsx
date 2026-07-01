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
import { useWorkoutProgressStore, dayKey } from '../progressStore';
import { useSavedProgram } from '../hooks/useSavedProgram';
import { exerciseImageUrl } from '../data/exerciseLookup';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';

const ACCENT = '#F97316';

const MUSCLE_COLORS: Record<string, { from: string; to: string; icon: IconName }> = {
  chest: { from: '#EF4444', to: '#FF4D6D', icon: 'flame' },
  back: { from: '#3B82F6', to: '#60A5FA', icon: 'trending' },
  shoulders: { from: '#F59E0B', to: '#F5C451', icon: 'zap' },
  'rear delts': { from: '#F97316', to: '#FB923C', icon: 'zap' },
  biceps: { from: '#8B5CF6', to: '#A78BFA', icon: 'dumbbell' },
  triceps: { from: '#A855F7', to: '#C084FC', icon: 'dumbbell' },
  arms: { from: '#8B5CF6', to: '#C084FC', icon: 'dumbbell' },
  quads: { from: '#10B981', to: '#2EE6A6', icon: 'target' },
  hamstrings: { from: '#14B8A6', to: '#2DD4BF', icon: 'target' },
  glutes: { from: '#EC4899', to: '#F472B6', icon: 'heart' },
  calves: { from: '#06B6D4', to: '#22D3EE', icon: 'arrow-up' },
  traps: { from: '#64748B', to: '#94A3B8', icon: 'arrow-up' },
  core: { from: '#84CC16', to: '#A3E635', icon: 'target' },
};
const FALLBACK_COLOR = { from: '#52525B', to: '#74748A', icon: 'dumbbell' as IconName };
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
  const completed = useWorkoutProgressStore((s) => s.completed);
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
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.32,
            shadowRadius: 28,
          }}
        >
          <LinearGradient
            colors={
              ['#0F172A', '#7C2D12', '#F97316'] as unknown as readonly [string, string, ...string[]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 20 }}
          >
            {/* Decorative orbs in the top-right corner */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -60,
                right: -50,
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -10,
                right: -25,
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            />
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

            <View
              className="flex-row items-center self-start mb-3"
              style={{
                gap: 7,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.24)',
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: '#2EE6A6',
                  shadowColor: '#2EE6A6',
                  shadowOpacity: 0.9,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
              <Text
                className="text-white text-[9px] font-extrabold uppercase"
                style={{ letterSpacing: 1.4 }}
              >
                {t('routines.activeProgram')}
              </Text>
            </View>

            <Text
              className="text-white font-extrabold tracking-tight"
              style={{ fontSize: 28, lineHeight: 32 }}
              numberOfLines={2}
            >
              {program.name}
            </Text>

            <View className="flex-row mt-5" style={{ gap: 8 }}>
              <Stat icon="calendar" label={t('routines.weeks')} value={String(program.weeks)} />
              <Stat
                icon="flame"
                label={t('routines.daysPerWeek')}
                value={String(program.days_per_week)}
              />
              <Stat
                icon="dumbbell"
                label={t('routines.exercises')}
                value={String(totalExercises)}
              />
              <Stat icon="bar-chart" label={t('routines.sessions')} value={String(totalSessions)} />
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
          {daysInWeek.map((d, idx) => {
            const isDone = !!(id && completed[dayKey(id, d.week, d.day_index)]);
            return (
              <DayCard
                key={`${d.week}-${d.day_index}`}
                day={d}
                dayNumber={idx + 1}
                defaultOpen={idx === 0 && !isDone}
                completed={isDone}
                onSelectExercise={setSelectedExercise}
                onStart={() =>
                  router.push(
                    `/routines/generate-program/walkthrough?week=${d.week}&day=${d.day_index}&pid=${id ?? ''}` as never,
                  )
                }
              />
            );
          })}
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

function Stat({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  return (
    <View
      className="rounded-xl"
      style={{
        flex: 1,
        paddingVertical: 9,
        paddingHorizontal: 9,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
      }}
    >
      {icon ? (
        <View className="mb-1">
          <Icon name={icon} size={11} color="rgba(255,255,255,0.85)" />
        </View>
      ) : null}
      <Text
        className="text-white font-extrabold tracking-tight"
        style={{ fontSize: 19, lineHeight: 21 }}
      >
        {value}
      </Text>
      <Text
        className="text-white/80 text-[9px] font-bold uppercase mt-0.5"
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
      <Pressable
        onPress={onPress}
        style={{
          borderRadius: 999,
          shadowColor: ACCENT,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 12,
        }}
      >
        <LinearGradient
          colors={['#FF4D2E', '#F97316'] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 11,
            paddingHorizontal: 20,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.18)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
            }}
          />
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
        paddingVertical: 11,
        paddingHorizontal: 20,
        borderRadius: 999,
        backgroundColor: '#17171B',
        borderWidth: 1,
        borderColor: '#21212B',
      }}
    >
      <Text className="text-ink-muted text-[12px] font-bold tracking-tight">
        {weekLabel}
        {isDeload ? ` · ${t('routines.deload')}` : ''}
      </Text>
    </Pressable>
  );
}

function DayCard({
  day,
  dayNumber,
  defaultOpen,
  completed,
  onSelectExercise,
  onStart,
}: {
  day: { week: number; day_index: number; name: string; exercises: ProgramExercise[] };
  dayNumber: number;
  defaultOpen?: boolean;
  completed?: boolean;
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
    <Pressable onPress={() => setOpen((o) => !o)} className="mb-3">
      <View
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: '#17171B',
          borderWidth: 1,
          borderColor: open ? `${dayColor.from}55` : '#21212B',
          shadowColor: open ? dayColor.from : '#000',
          shadowOffset: { width: 0, height: open ? 8 : 2 },
          shadowOpacity: open ? 0.25 : 0.15,
          shadowRadius: open ? 16 : 6,
        }}
      >
        <LinearGradient
          colors={
            (open
              ? ['transparent', dayColor.from, 'transparent']
              : ['transparent', `${dayColor.from}33`, 'transparent']) as unknown as readonly [
              string,
              string,
              ...string[],
            ]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: open ? 2 : 1 }}
        />

        <View className="flex-row items-center p-3.5">
          <View
            style={{
              shadowColor: dayColor.from,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              marginRight: 12,
            }}
          >
            <LinearGradient
              colors={
                [dayColor.from, dayColor.to] as unknown as readonly [string, string, ...string[]]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <Text
                className="text-white/80 font-extrabold"
                style={{ fontSize: 8, letterSpacing: 1, marginBottom: -2 }}
              >
                DAY
              </Text>
              <Text className="text-white font-extrabold tracking-tight" style={{ fontSize: 16 }}>
                {dayNumber}
              </Text>
            </LinearGradient>
            {completed ? (
              <View
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#12B886',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#0A0A0F',
                }}
              >
                <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            ) : null}
          </View>

          <View className="flex-1">
            <Text className="text-ink text-[16px] font-extrabold tracking-tight" numberOfLines={1}>
              {day.name}
            </Text>
            <View className="flex-row items-center mt-1.5" style={{ gap: 6, flexWrap: 'wrap' }}>
              {completed ? (
                <View
                  className="flex-row items-center rounded-full"
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    backgroundColor: 'rgba(18,184,134,0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(18,184,134,0.45)',
                    gap: 4,
                  }}
                >
                  <Icon name="check" size={9} color="#12B886" strokeWidth={3} />
                  <Text
                    className="text-[9px] font-extrabold uppercase"
                    style={{ color: '#12B886', letterSpacing: 0.6 }}
                  >
                    {t('routines.completed', { defaultValue: 'Completed' })}
                  </Text>
                </View>
              ) : null}
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
              width: 28,
              height: 28,
              backgroundColor: open ? `${dayColor.from}26` : 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: open ? `${dayColor.from}40` : '#21212B',
            }}
          >
            <Icon
              name={open ? 'chevron-down' : 'chevron-right'}
              size={13}
              color={open ? dayColor.from : '#B4B4C2'}
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
          <View className="px-3 pb-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: '#21212B' }}>
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
                    (completed
                      ? ['#1B1B25', '#1B1B25']
                      : [dayColor.from, dayColor.to]) as unknown as readonly [
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
                    borderWidth: completed ? 1 : 0,
                    borderColor: 'rgba(18,184,134,0.45)',
                  }}
                >
                  <Icon
                    name={completed ? 'history' : 'play'}
                    size={14}
                    color={completed ? '#12B886' : '#FFFFFF'}
                  />
                  <Text
                    className="font-extrabold tracking-tight"
                    style={{ fontSize: 14, color: completed ? '#12B886' : '#FFFFFF' }}
                  >
                    {completed
                      ? t('routines.redoWorkout', { defaultValue: 'Redo workout' })
                      : t('routines.startWorkout')}
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
  const imageUrl = exerciseImageUrl(ex.name, 0, ex.muscle_group);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!imageUrl && !imgFailed;

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginVertical: 2,
        borderRadius: 14,
        backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent',
      })}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 14,
          overflow: 'hidden',
          marginRight: 12,
          backgroundColor: '#0A0A0F',
          borderWidth: 1,
          borderColor: `${c.from}55`,
          shadowColor: c.from,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
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
            <Icon name={c.icon} size={24} color="#FFFFFF" />
          </LinearGradient>
        )}
        {/* subtle bottom darken for caption legibility */}
        <LinearGradient
          colors={
            ['transparent', 'rgba(0,0,0,0.6)'] as unknown as readonly [string, string, ...string[]]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '55%',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: 4,
            backgroundColor: 'rgba(0,0,0,0.65)',
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
          }}
        >
          <Text className="text-white font-extrabold" style={{ fontSize: 9 }}>
            {index}
          </Text>
        </View>
      </View>

      <View className="flex-1 mr-2">
        <Text className="text-ink text-[14px] font-extrabold tracking-tight" numberOfLines={1}>
          {ex.name}
        </Text>
        {ex.muscle_group ? (
          <View
            className="flex-row items-center mt-1 self-start"
            style={{
              gap: 4,
              paddingHorizontal: 6,
              paddingVertical: 1.5,
              borderRadius: 999,
              backgroundColor: `${c.from}1A`,
              borderWidth: 1,
              borderColor: `${c.from}33`,
            }}
          >
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: c.from,
              }}
            />
            <Text
              className="text-[9px] font-extrabold uppercase"
              style={{ color: c.from, letterSpacing: 0.7 }}
            >
              {ex.muscle_group}
            </Text>
          </View>
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
          width: 24,
          height: 24,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: '#21212B',
        }}
      >
        <Icon name="chevron-right" size={12} color="#B4B4C2" />
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
        borderColor: color ? `${color}40` : '#21212B',
      }}
    >
      <Text
        className="font-extrabold"
        style={{
          fontSize: 10,
          color: color ?? '#B4B4C2',
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
        borderColor: '#21212B',
        gap: 4,
      }}
    >
      <Icon name={icon} size={9} color="#B4B4C2" />
      <Text className="text-ink-muted text-[9px] font-bold" style={{ letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}
