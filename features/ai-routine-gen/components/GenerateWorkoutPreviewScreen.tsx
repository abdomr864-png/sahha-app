import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Header, Icon, Screen } from '@features/shared';
import type { IconName } from '@features/shared';
import { useSession } from '@features/auth';
import { muscleVisual, useStartWorkout, useWorkoutSessionStore } from '@features/workouts';
import type { WorkoutExercise } from '@lib/llm';
import { useDraftRoutineStore } from '../store';
import { saveWorkoutAsTemplate } from '../repositories/routines';
import { useGenerateWorkout } from '../hooks/useGenerateWorkout';
import { exerciseImageUrl } from '../data/exerciseLookup';

// Shared per-muscle palette — keeps the preview, saved program, and live
// session visually identical for the same exercise.
const colorFor = muscleVisual;

const ACCENT = '#F97316';

type GradientColors = readonly [string, string, ...string[]];

export function GenerateWorkoutPreviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const draft = useDraftRoutineStore((s) => s.draft);
  const patch = useDraftRoutineStore((s) => s.patchWorkoutExercise);
  const remove = useDraftRoutineStore((s) => s.removeWorkoutExercise);
  const reorder = useDraftRoutineStore((s) => s.reorderWorkoutExercise);
  const discard = useDraftRoutineStore((s) => s.discard);
  const startWorkout = useStartWorkout();
  const addExercise = useWorkoutSessionStore((s) => s.addExercise);
  const { generate, loading: regenLoading } = useGenerateWorkout();
  const [saving, setSaving] = useState(false);

  const workout = draft && draft.kind === 'workout' ? draft.workout : null;

  const totalSets = useMemo(
    () => workout?.exercises.reduce((acc, e) => acc + e.sets, 0) ?? 0,
    [workout],
  );

  // Unique muscle groups hit by this workout, in first-seen order — drives the
  // "targets" chip strip so the user sees the focus at a glance.
  const muscles = useMemo(() => {
    const seen: string[] = [];
    for (const e of workout?.exercises ?? []) {
      const m = e.muscle_group?.trim();
      if (m && !seen.includes(m.toLowerCase())) seen.push(m.toLowerCase());
    }
    return seen;
  }, [workout]);

  if (!draft || draft.kind !== 'workout' || !workout) {
    return (
      <Screen>
        <Header title={t('routines.preview', 'Preview')} showBack />
        <Text className="text-ink-subtle">{t('routines.noDraft', 'No draft to preview.')}</Text>
      </Screen>
    );
  }
  const w = workout;

  const onRegenerate = () => {
    if (draft.edited) {
      Alert.alert(
        t('routines.regenWarnTitle', 'Replace your edits?'),
        t(
          'routines.regenWarnBody',
          "You've edited this draft. Regenerating will discard those changes.",
        ),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('routines.regen', 'Regenerate'),
            style: 'destructive',
            onPress: () => {
              void generate({ type: 'today', duration_minutes: 60 });
            },
          },
        ],
      );
      return;
    }
    void generate({ type: 'today', duration_minutes: 60 });
  };

  const onSave = async () => {
    if (!session?.user) return;
    setSaving(true);
    try {
      await saveWorkoutAsTemplate(session.user.id, w, draft.generation_id);
      discard();
      router.replace('/routines');
    } finally {
      setSaving(false);
    }
  };

  const onStart = async () => {
    if (!session?.user) return;
    await startWorkout(w.name);
    for (const ex of w.exercises) {
      if (ex.matched_exercise_id) addExercise(ex.matched_exercise_id);
    }
    discard();
    router.replace('/session');
  };

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-4">
        <Header title={t('routines.preview', 'Your workout')} showBack />
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
            colors={['#1E1B4B', '#7C2D12', '#F97316'] as unknown as GradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 18 }}
          >
            <LinearGradient
              colors={
                ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as unknown as GradientColors
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%' }}
            />

            <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' }} />
              <Text
                className="text-white text-[10px] font-extrabold uppercase"
                style={{ letterSpacing: 1.2, opacity: 0.9 }}
              >
                {t('routines.aiWorkout', 'AI Workout')}
              </Text>
            </View>

            <Text
              className="text-white font-extrabold tracking-tight"
              style={{ fontSize: 24, lineHeight: 28 }}
              numberOfLines={2}
            >
              {w.name}
            </Text>
            {w.description ? (
              <Text
                className="text-white/85 text-[12px] mt-1.5"
                style={{ lineHeight: 17 }}
                numberOfLines={3}
              >
                {w.description}
              </Text>
            ) : null}

            {/* Stats strip */}
            <View className="flex-row mt-4" style={{ gap: 8 }}>
              <Stat label={t('common.min', 'min')} value={String(w.estimated_duration_min)} />
              <Stat
                label={t('routines.exercises', 'Exercises')}
                value={String(w.exercises.length)}
              />
              <Stat label={t('routines.setsShort', 'Sets')} value={String(totalSets)} />
              <Stat label={t('routines.focusShort', 'Focus')} value={focusLabel(w.focus)} />
            </View>
          </LinearGradient>
        </View>

        {/* Muscle targets */}
        {muscles.length > 0 ? (
          <View className="flex-row flex-wrap mb-4" style={{ gap: 6 }}>
            {muscles.map((m) => {
              const mc = colorFor(m);
              return (
                <View
                  key={m}
                  className="flex-row items-center rounded-full"
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    backgroundColor: `${mc.from}1A`,
                    borderWidth: 1,
                    borderColor: `${mc.from}40`,
                    gap: 5,
                  }}
                >
                  <Icon name={mc.icon} size={11} color={mc.from} />
                  <Text
                    className="text-[10px] font-extrabold uppercase"
                    style={{ color: mc.from, letterSpacing: 0.6 }}
                  >
                    {m}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* AI reasoning */}
        {w.reasoning ? (
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
                {t('routines.aiReasoning', "Coach's notes")}
              </Text>
            </View>
            <Text className="text-ink-subtle text-[13px]" style={{ lineHeight: 19 }}>
              {w.reasoning}
            </Text>
          </View>
        ) : null}

        {/* Warm-up */}
        {w.warm_up_protocol ? (
          <ProtocolCard
            label={t('routines.warmup', 'Warm-up')}
            icon="flame"
            color="#FB923C"
            body={w.warm_up_protocol}
          />
        ) : null}

        {/* Exercises */}
        <Text
          className="text-ink-muted text-[10px] font-extrabold uppercase mb-2.5 mt-1"
          style={{ letterSpacing: 1.2 }}
        >
          {t('routines.exercises', 'Exercises')}
        </Text>
        {w.exercises.map((ex, i) => (
          <ExerciseRow
            key={`${ex.name}-${i}`}
            ex={ex}
            index={i + 1}
            onPatch={(p) => patch(i, p)}
            onRemove={() => remove(i)}
            onMoveUp={i > 0 ? () => reorder(i, i - 1) : undefined}
            onMoveDown={i < w.exercises.length - 1 ? () => reorder(i, i + 1) : undefined}
          />
        ))}

        {/* Cool-down */}
        {w.cool_down_protocol ? (
          <ProtocolCard
            label={t('routines.cooldown', 'Cool-down')}
            icon="heart"
            color="#2BD2FF"
            body={w.cool_down_protocol}
          />
        ) : null}

        <View style={{ height: 16 }} />

        {/* CTAs */}
        <View style={{ gap: 10 }}>
          <PrimaryCTA label={t('routines.startNow', 'Start now')} icon="play" onPress={onStart} />
          <SecondaryCTA
            label={
              saving ? t('common.saving', 'Saving…') : t('routines.saveTemplate', 'Save as routine')
            }
            icon="bookmark"
            onPress={onSave}
            disabled={saving}
          />
          <SecondaryCTA
            label={
              regenLoading
                ? t('routines.regenerating', 'Regenerating…')
                : t('routines.regen', 'Regenerate')
            }
            icon="sparkles"
            onPress={onRegenerate}
            disabled={regenLoading}
          />
        </View>

        <View style={{ height: 32 }} />
      </View>
    </Screen>
  );
}

function focusLabel(focus: string): string {
  const f = focus.trim();
  if (!f) return '—';
  // Keep the strip tidy: first word, capitalized.
  const first = f.split(/[\s_]+/)[0] ?? f;
  return first.charAt(0).toUpperCase() + first.slice(1);
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
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        className="text-white/75 text-[9px] font-bold uppercase mt-0.5"
        style={{ letterSpacing: 0.8 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function ProtocolCard({
  label,
  icon,
  color,
  body,
}: {
  label: string;
  icon: IconName;
  color: string;
  body: string;
}) {
  return (
    <View
      className="rounded-2xl border mb-2.5"
      style={{ backgroundColor: '#17171B', borderColor: '#21212B', padding: 14 }}
    >
      <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
        <View
          className="rounded-full items-center justify-center"
          style={{
            width: 26,
            height: 26,
            backgroundColor: `${color}26`,
            borderWidth: 1,
            borderColor: `${color}59`,
          }}
        >
          <Icon name={icon} size={13} color={color} />
        </View>
        <Text
          className="text-[10px] font-extrabold uppercase"
          style={{ color, letterSpacing: 1.2 }}
        >
          {label}
        </Text>
      </View>
      <Text className="text-ink-subtle text-[13px]" style={{ lineHeight: 19 }}>
        {body}
      </Text>
    </View>
  );
}

function ExerciseRow({
  ex,
  index,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  ex: WorkoutExercise;
  index: number;
  onPatch: (p: Partial<WorkoutExercise>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const c = colorFor(ex.muscle_group);
  const imageUrl = exerciseImageUrl(ex.name, 0, ex.muscle_group);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!imageUrl && !imgFailed;

  return (
    <View
      className="rounded-2xl overflow-hidden mb-2.5"
      style={{
        backgroundColor: '#17171B',
        borderWidth: 1,
        borderColor: expanded ? `${c.from}50` : '#21212B',
      }}
    >
      <Pressable onPress={() => setExpanded((e) => !e)} className="flex-row items-center p-3">
        {/* Photo thumbnail (with gradient fallback) */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            overflow: 'hidden',
            marginRight: 10,
            backgroundColor: '#0A0A0F',
            borderWidth: 1,
            borderColor: `${c.from}40`,
            shadowColor: c.from,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
          }}
        >
          {showImage ? (
            <>
              <Image
                source={{ uri: imageUrl }}
                onError={() => setImgFailed(true)}
                resizeMode="cover"
                style={{ width: '100%', height: '100%', backgroundColor: c.from }}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)'] as unknown as GradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  bottom: 0,
                  top: 0,
                  width: 3,
                  backgroundColor: c.from,
                }}
              />
            </>
          ) : (
            <LinearGradient
              colors={[c.from, c.to] as unknown as GradientColors}
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
          <View className="flex-row items-center" style={{ gap: 6 }}>
            {ex.is_warmup ? (
              <View
                className="rounded"
                style={{
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  backgroundColor: 'rgba(251,146,60,0.16)',
                  borderWidth: 1,
                  borderColor: 'rgba(251,146,60,0.4)',
                }}
              >
                <Text
                  className="text-[8px] font-extrabold uppercase"
                  style={{ color: '#FB923C', letterSpacing: 0.5 }}
                >
                  {t('routines.warmupTag', 'Warm-up')}
                </Text>
              </View>
            ) : null}
            <Text
              className="text-ink text-[13px] font-bold tracking-tight flex-1"
              numberOfLines={1}
            >
              {ex.name}
            </Text>
          </View>
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
          <ColoredSpecPill color={c.from}>{`${ex.sets}×${ex.rep_scheme}`}</ColoredSpecPill>
          <View className="flex-row" style={{ gap: 3 }}>
            <SpecPill>{`RPE ${ex.target_rpe}`}</SpecPill>
            <SpecPill>{`${ex.rest_seconds}s`}</SpecPill>
          </View>
        </View>

        <View
          className="ml-2 rounded-full items-center justify-center"
          style={{
            width: 22,
            height: 22,
            backgroundColor: expanded ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: expanded ? 'rgba(249,115,22,0.3)' : '#21212B',
          }}
        >
          <Icon
            name={expanded ? 'chevron-down' : 'chevron-right'}
            size={11}
            color={expanded ? ACCENT : '#B4B4C2'}
          />
        </View>
      </Pressable>

      {/* Inline editor */}
      {expanded ? (
        <View className="px-3 pb-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: '#21212B' }}>
          {ex.notes ? (
            <Text className="text-ink-subtle text-xs mb-2" style={{ lineHeight: 17 }}>
              📝 {ex.notes}
            </Text>
          ) : null}
          <RowInput
            label={t('routines.sets', 'Sets')}
            value={String(ex.sets)}
            onChange={(v) => onPatch({ sets: Math.max(1, parseInt(v, 10) || 1) })}
            keyboardType="number-pad"
          />
          <RowInput
            label={t('routines.reps', 'Reps')}
            value={ex.rep_scheme}
            onChange={(v) => onPatch({ rep_scheme: v })}
          />
          <RowInput
            label={t('routines.rpe', 'RPE')}
            value={String(ex.target_rpe)}
            onChange={(v) => onPatch({ target_rpe: Math.max(1, Math.min(10, parseFloat(v) || 7)) })}
            keyboardType="numeric"
          />
          <RowInput
            label={t('routines.rest', 'Rest (s)')}
            value={String(ex.rest_seconds)}
            onChange={(v) => onPatch({ rest_seconds: Math.max(0, parseInt(v, 10) || 60) })}
            keyboardType="number-pad"
          />
          <View className="flex-row items-center mt-3" style={{ gap: 8 }}>
            {onMoveUp ? <MiniBtn icon="arrow-up" onPress={onMoveUp} /> : null}
            {onMoveDown ? <MiniBtn icon="arrow-up" flip onPress={onMoveDown} /> : null}
            <View className="flex-1" />
            <Pressable
              onPress={onRemove}
              className="flex-row items-center rounded-xl"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: 'rgba(255,77,109,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,77,109,0.35)',
                gap: 5,
              }}
            >
              <Icon name="trash" size={13} color="#FF4D6D" />
              <Text className="text-[12px] font-extrabold" style={{ color: '#FF4D6D' }}>
                {t('common.delete', 'Delete')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MiniBtn({ icon, flip, onPress }: { icon: IconName; flip?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl items-center justify-center"
      style={{
        width: 38,
        height: 36,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: '#21212B',
      }}
    >
      <View style={flip ? { transform: [{ rotate: '180deg' }] } : undefined}>
        <Icon name={icon} size={15} color="#B4B4C2" />
      </View>
    </Pressable>
  );
}

function RowInput({
  label,
  value,
  onChange,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'numeric';
}) {
  return (
    <View className="flex-row items-center mb-1.5">
      <Text className="w-20 text-ink-subtle text-xs font-semibold">{label}</Text>
      <View className="flex-1 bg-bg-subtle border border-border rounded-xl px-3 py-2">
        <TextInput
          value={value}
          onChangeText={onChange}
          className="text-ink text-sm"
          placeholderTextColor="#74748A"
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

function ColoredSpecPill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <View
      className="rounded-md"
      style={{
        paddingHorizontal: 7,
        paddingVertical: 3,
        backgroundColor: `${color}1A`,
        borderWidth: 1,
        borderColor: `${color}40`,
      }}
    >
      <Text className="font-extrabold" style={{ fontSize: 11, color, letterSpacing: 0.3 }}>
        {children}
      </Text>
    </View>
  );
}

function SpecPill({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="rounded-md"
      style={{
        paddingHorizontal: 6,
        paddingVertical: 3,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: '#21212B',
      }}
    >
      <Text
        className="font-extrabold"
        style={{ fontSize: 10, color: '#B4B4C2', letterSpacing: 0.3 }}
      >
        {children}
      </Text>
    </View>
  );
}

function PrimaryCTA({
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
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() =>
        !disabled && (scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }))
      }
      onPressOut={() => (scale.value = withSpring(1, { damping: 20, stiffness: 400 }))}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            borderRadius: 16,
            overflow: 'hidden',
            opacity: disabled ? 0.6 : 1,
            shadowColor: ACCENT,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: disabled ? 0 : 0.3,
            shadowRadius: 18,
          },
        ]}
      >
        <LinearGradient
          colors={['#FF4D2E', '#F97316', '#FB923C'] as unknown as GradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon ? (
            <View style={{ marginRight: 8 }}>
              <Icon name={icon} size={16} color="#FFFFFF" />
            </View>
          ) : null}
          <Text className="text-white font-extrabold tracking-tight" style={{ fontSize: 15 }}>
            {label}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

function SecondaryCTA({
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
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 22,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#21212B',
        backgroundColor: '#17171B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon ? <Icon name={icon} size={14} color="#B4B4C2" /> : null}
      <Text className="text-ink-muted font-bold tracking-tight ml-1.5" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}
