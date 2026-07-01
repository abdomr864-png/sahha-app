import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ExerciseAnimation } from './ExerciseAnimation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Icon, Screen } from '@features/shared';
import { useDraftRoutineStore } from '../store';
import { useWorkoutProgressStore } from '../progressStore';
import { exerciseImages, exerciseInfo } from '../data/exerciseLookup';

const ACCENT = '#F97316';
const MUSCLE_COLORS: Record<string, string> = {
  chest: '#EF4444',
  back: '#3B82F6',
  shoulders: '#F59E0B',
  'rear delts': '#F97316',
  biceps: '#8B5CF6',
  triceps: '#A855F7',
  arms: '#8B5CF6',
  quads: '#10B981',
  hamstrings: '#14B8A6',
  glutes: '#EC4899',
  calves: '#06B6D4',
  traps: '#64748B',
  core: '#84CC16',
};

export function WorkoutWalkthroughScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { week, day, pid } = useLocalSearchParams<{
    week?: string;
    day?: string;
    pid?: string;
  }>();
  const draft = useDraftRoutineStore((s) => s.draft);
  const program = draft && draft.kind === 'program' ? draft.program : null;
  const markComplete = useWorkoutProgressStore((s) => s.markComplete);

  const wk = parseInt(week ?? '1', 10);
  const di = parseInt(day ?? '0', 10);

  const dayData = program?.days.find((d) => d.week === wk && d.day_index === di);

  const [exIdx, setExIdx] = useState(0);

  const exercises = dayData?.exercises ?? [];
  const ex = exercises[exIdx];
  const accent = ex?.muscle_group
    ? (MUSCLE_COLORS[ex.muscle_group.toLowerCase()] ?? ACCENT)
    : ACCENT;
  const images = ex ? exerciseImages(ex.name, ex.muscle_group) : [];
  const info = ex ? exerciseInfo(ex.name) : null;

  const progress = exercises.length ? (exIdx + 1) / exercises.length : 0;
  const progressWidth = useSharedValue(progress);
  useEffect(() => {
    progressWidth.value = withTiming(progress, { duration: 320 });
  }, [progress, progressWidth]);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  if (!program || !dayData || !ex) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="rounded-3xl items-center justify-center mb-4"
            style={{
              width: 64,
              height: 64,
              backgroundColor: 'rgba(249,115,22,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(249,115,22,0.25)',
            }}
          >
            <Icon name="x" size={26} color={ACCENT} />
          </View>
          <Text className="text-ink text-lg font-extrabold tracking-tight">
            {t('routines.workoutNotFound')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-5 rounded-2xl px-5 py-3"
            style={{
              backgroundColor: '#17171B',
              borderWidth: 1,
              borderColor: '#21212B',
            }}
          >
            <Text className="text-ink-muted font-bold">{t('common.back')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const isLast = exIdx === exercises.length - 1;
  const goPrev = () => setExIdx((i) => Math.max(0, i - 1));
  const finish = () => {
    // Mark this program day done so it shows as completed on return instead of
    // looking like an untouched session the user still has to do.
    if (pid) markComplete(pid, wk, di);
    router.replace('/(tabs)');
  };
  const goNext = () => (isLast ? finish() : setExIdx((i) => i + 1));

  return (
    <Screen padded={false}>
      {/* Top bar */}
      <View className="px-5 pt-2 pb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Pressable
            onPress={() => router.back()}
            className="rounded-full items-center justify-center"
            style={{
              width: 36,
              height: 36,
              backgroundColor: '#17171B',
              borderWidth: 1,
              borderColor: '#21212B',
            }}
          >
            <Icon name="x" size={16} color="#B4B4C2" />
          </Pressable>

          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: accent,
                shadowColor: accent,
                shadowOpacity: 0.8,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 0 },
              }}
            />
            <Text
              className="text-[10px] font-extrabold uppercase"
              style={{ color: accent, letterSpacing: 1.2 }}
            >
              {t('routines.liveDay', { name: dayData.name })}
            </Text>
          </View>

          <Text
            className="text-ink-muted text-[10px] font-extrabold"
            style={{ letterSpacing: 1.2 }}
          >
            {exIdx + 1} / {exercises.length}
          </Text>
        </View>

        {/* Progress bar */}
        <View
          className="rounded-full overflow-hidden"
          style={{ height: 5, backgroundColor: '#1F1F23' }}
        >
          <Animated.View style={[{ height: 5 }, progressStyle]}>
            <LinearGradient
              colors={[accent, accent + 'CC'] as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Animated hero image */}
        <Animated.View
          key={`hero-${exIdx}`}
          entering={SlideInRight.duration(280)}
          exiting={FadeOut.duration(180)}
        >
          {images.length > 0 ? (
            <View
              style={{
                marginHorizontal: 20,
                height: 280,
                borderRadius: 24,
                overflow: 'hidden',
                backgroundColor: '#17171B',
                borderWidth: 1,
                borderColor: `${accent}40`,
                shadowColor: accent,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 22,
              }}
            >
              {/* Smooth cross-fade animation between start/end frames */}
              <ExerciseAnimation
                key={`anim-${exIdx}`}
                images={images}
                durationMs={550}
                fadeMs={500}
                style={{ width: '100%', height: '100%' }}
              />
              {/* Top accent stripe */}
              <LinearGradient
                colors={
                  [accent, 'transparent'] as unknown as readonly [string, string, ...string[]]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                }}
              />
              {/* Bottom scrim */}
              <LinearGradient
                colors={
                  ['transparent', 'rgba(11,11,15,0.85)'] as unknown as readonly [
                    string,
                    string,
                    ...string[],
                  ]
                }
                start={{ x: 0, y: 0.4 }}
                end={{ x: 0, y: 1 }}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 100,
                }}
              />
              {/* Live "REPS" badge */}
              <View
                className="absolute flex-row items-center"
                style={{
                  top: 12,
                  left: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  gap: 5,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: accent,
                  }}
                />
                <Text
                  className="text-white text-[9px] font-extrabold uppercase"
                  style={{ letterSpacing: 1.2 }}
                >
                  {t('routines.liveDemo')}
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={{
                marginHorizontal: 20,
                height: 220,
                borderRadius: 24,
                backgroundColor: '#17171B',
                borderWidth: 1,
                borderColor: '#21212B',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="dumbbell" size={42} color="#34343F" />
            </View>
          )}
        </Animated.View>

        {/* Body */}
        <Animated.View
          key={`body-${exIdx}`}
          entering={FadeIn.duration(280).delay(100)}
          className="px-5 mt-5"
        >
          <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: accent,
              }}
            />
            <Text
              className="text-[10px] font-extrabold uppercase"
              style={{ color: accent, letterSpacing: 1.2 }}
            >
              {ex.muscle_group ?? t('exercise.label')}
            </Text>
          </View>

          <Text
            className="text-ink font-extrabold tracking-tight"
            style={{ fontSize: 26, lineHeight: 30 }}
          >
            {ex.name}
          </Text>

          {info ? (
            <View className="flex-row mt-3" style={{ gap: 6, flexWrap: 'wrap' }}>
              {info.equipment ? <Tag>{info.equipment}</Tag> : null}
              {info.level ? <Tag>{info.level}</Tag> : null}
              {info.mechanic ? <Tag>{info.mechanic}</Tag> : null}
            </View>
          ) : null}

          {/* Spec cards */}
          <View className="flex-row mt-5" style={{ gap: 8 }}>
            <SpecBig
              label={t('routines.setsXReps')}
              value={`${ex.sets} × ${ex.reps}`}
              accent={accent}
            />
            <SpecBig
              label={t('train.session.rest')}
              value={`${ex.rest_seconds}${t('common.sec')}`}
            />
            {ex.rpe ? <SpecBig label={t('routines.rpe')} value={String(ex.rpe)} /> : null}
          </View>

          {/* Instructions */}
          {info?.instructions?.length ? (
            <View className="mt-6">
              <Text
                className="text-ink-muted text-[10px] font-extrabold uppercase mb-3"
                style={{ letterSpacing: 1.2 }}
              >
                {t('routines.howToDo')}
              </Text>
              {info.instructions.map((step, i) => (
                <View key={i} className="flex-row mb-3" style={{ gap: 12 }}>
                  <View
                    className="rounded-full items-center justify-center"
                    style={{
                      width: 26,
                      height: 26,
                      backgroundColor: `${accent}1F`,
                      borderWidth: 1,
                      borderColor: `${accent}40`,
                    }}
                  >
                    <Text className="text-[12px] font-extrabold" style={{ color: accent }}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text className="text-ink text-[14px] flex-1" style={{ lineHeight: 20 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Muscles */}
          {info && (info.primaryMuscles.length || info.secondaryMuscles.length) ? (
            <View className="mt-5">
              <Text
                className="text-ink-muted text-[10px] font-extrabold uppercase mb-3"
                style={{ letterSpacing: 1.2 }}
              >
                {t('routines.musclesTrained')}
              </Text>
              <View className="flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {info.primaryMuscles.map((m) => (
                  <View
                    key={`p-${m}`}
                    className="rounded-full px-3 py-1"
                    style={{
                      backgroundColor: `${accent}1F`,
                      borderWidth: 1,
                      borderColor: `${accent}40`,
                    }}
                  >
                    <Text
                      className="text-[11px] font-extrabold uppercase"
                      style={{ color: accent, letterSpacing: 0.5 }}
                    >
                      {m}
                    </Text>
                  </View>
                ))}
                {info.secondaryMuscles.map((m) => (
                  <View
                    key={`s-${m}`}
                    className="rounded-full px-3 py-1"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: '#21212B',
                    }}
                  >
                    <Text
                      className="text-ink-muted text-[11px] font-bold uppercase"
                      style={{ letterSpacing: 0.5 }}
                    >
                      {m}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Sticky footer */}
      <View
        className="absolute left-0 right-0 bottom-0 px-5 pb-6 pt-3"
        style={{
          backgroundColor: 'rgba(11,11,15,0.96)',
          borderTopWidth: 1,
          borderColor: '#21212B',
        }}
      >
        <View className="flex-row" style={{ gap: 10 }}>
          {exIdx > 0 ? (
            <Pressable
              onPress={goPrev}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 18,
                borderRadius: 16,
                backgroundColor: '#17171B',
                borderWidth: 1,
                borderColor: '#21212B',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="chevron-left" size={14} color="#B4B4C2" />
              <Text
                className="text-ink-muted font-bold tracking-tight ml-1.5"
                style={{ fontSize: 14 }}
              >
                {t('common.back')}
              </Text>
            </Pressable>
          ) : null}
          <View className="flex-1">
            <NextCTA
              label={isLast ? t('routines.finishWorkout') : t('routines.nextExercise')}
              icon={isLast ? 'check' : 'chevron-right'}
              onPress={goNext}
              accent={accent}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <View
      className="rounded-full"
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: '#21212B',
      }}
    >
      <Text
        className="text-ink-muted text-[11px] font-bold capitalize"
        style={{ letterSpacing: 0.3 }}
      >
        {children}
      </Text>
    </View>
  );
}

function SpecBig({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View
      className="flex-1 rounded-2xl"
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: accent ? `${accent}10` : '#17171B',
        borderWidth: 1,
        borderColor: accent ? `${accent}30` : '#21212B',
      }}
    >
      <Text
        className="text-[9px] font-extrabold uppercase mb-1"
        style={{
          letterSpacing: 1,
          color: accent ?? '#B4B4C2',
        }}
      >
        {label}
      </Text>
      <Text
        className="font-extrabold tracking-tight"
        style={{
          fontSize: 18,
          color: accent ?? '#F4F4F7',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function NextCTA({
  label,
  icon,
  onPress,
  accent,
}: {
  label: string;
  icon: 'chevron-right' | 'check';
  onPress: () => void;
  accent: string;
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
        style={[
          animatedStyle,
          {
            borderRadius: 16,
            overflow: 'hidden',
            shadowColor: accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 18,
          },
        ]}
      >
        <LinearGradient
          colors={[accent, accent + 'CC'] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text className="text-white font-extrabold tracking-tight" style={{ fontSize: 15 }}>
            {label}
          </Text>
          <View style={{ marginLeft: 8 }}>
            <Icon name={icon} size={16} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}
