import { Alert, FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Icon, IconButton, Screen, useSafeBack } from '@features/shared';
import {
  muscleVisual,
  useActiveSession,
  useExerciseNames,
  useFinishWorkout,
  useWorkoutSessionStore,
  type ExerciseName,
  type SetDraft,
  type WorkoutExerciseDraft,
} from '@features/workouts';
import { exerciseImageUrl } from '@features/ai-routine-gen/data/exerciseLookup';
import { SuggestionCard } from '@features/progression';
import type { NextSessionSuggestion } from '@features/progression';
import { MiniPlayer, SpotifyConnectPrompt } from '@features/spotify';

const monoFamily = 'SpaceGrotesk_700Bold';
type GradientColors = readonly [string, string, ...string[]];

export default function Session() {
  const { t, i18n } = useTranslation();
  const locale = ((i18n.language as string | undefined) ?? 'en').slice(0, 2) as 'en' | 'fr' | 'ar';
  const _router = useRouter();
  const safeBack = useSafeBack('/routines');
  const draft = useActiveSession();
  const finish = useFinishWorkout();
  const discard = useWorkoutSessionStore((s) => s.discard);
  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const completeSet = useWorkoutSessionStore((s) => s.completeSet);
  const updateSet = useWorkoutSessionStore((s) => s.updateSet);
  const removeSet = useWorkoutSessionStore((s) => s.removeSet);

  const names = useExerciseNames(draft?.exercises.map((e) => e.exercise_id) ?? [], locale);

  /**
   * Pre-fill the most recent (or freshly added) set with the suggestion's
   * weight/reps so the user can tap-complete instead of typing. We add a set
   * if there are none yet, otherwise prefill the last non-completed one.
   */
  const acceptSuggestion = (workoutExerciseId: string, s: NextSessionSuggestion) => {
    if (!draft) return;
    const ex = draft.exercises.find((e) => e.id === workoutExerciseId);
    if (!ex) return;
    const target = ex.sets.find((x) => !x.completed) ?? null;
    const patch = {
      weight_kg: s.suggested_weight_kg ?? undefined,
      reps: s.suggested_reps ?? undefined,
    };
    if (target) {
      updateSet(workoutExerciseId, target.id, patch);
    } else {
      addSet(workoutExerciseId);
      // The new set is the last one — apply the patch on the next tick.
      setTimeout(() => {
        const fresh = useWorkoutSessionStore
          .getState()
          .draft?.exercises.find((e) => e.id === workoutExerciseId);
        const last = fresh?.sets[fresh.sets.length - 1];
        if (last) updateSet(workoutExerciseId, last.id, patch);
      }, 0);
    }
  };

  if (!draft) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <View className="w-16 h-16 rounded-2xl bg-bg-raised border border-border items-center justify-center mb-4">
            <Icon name="x" size={28} color="#B4B4C2" />
          </View>
          <Text className="text-ink-subtle text-base mb-6">{t('train.session.noActive')}</Text>
          <Button label={t('common.back')} variant="secondary" onPress={safeBack} />
        </View>
      </Screen>
    );
  }

  const onDiscard = () =>
    Alert.alert(t('common.appName'), t('train.session.discardConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('train.session.discard'),
        style: 'destructive',
        onPress: () => {
          discard();
          safeBack();
        },
      },
    ]);

  const totalSets = draft.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const completedSets = draft.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length,
    0,
  );
  const totalVolume = draft.exercises.reduce(
    (acc, e) =>
      acc + e.sets.reduce((a, s) => a + (s.completed ? (s.weight_kg ?? 0) * (s.reps ?? 0) : 0), 0),
    0,
  );
  const progress = totalSets > 0 ? completedSets / totalSets : 0;

  return (
    <Screen padded={false}>
      {/* Header */}
      <View className="px-5 pt-2 mb-4">
        <View className="flex-row items-center justify-between mb-5">
          <IconButton icon="chevron-left" onPress={safeBack} />
          <View className="flex-row items-center px-3 py-1.5 rounded-full bg-bg-raised border border-border">
            <View className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5" />
            <Text
              className="text-ink text-[10px] font-extrabold uppercase"
              style={{ letterSpacing: 1.2 }}
            >
              {t('train.session.live')}
            </Text>
          </View>
          <IconButton icon="x" onPress={onDiscard} />
        </View>
        <Text className="text-ink text-3xl font-extrabold tracking-tight">
          {draft.name || t('train.session.title')}
        </Text>

        {/* Live stats strip */}
        <View className="flex-row mt-5" style={{ gap: 10 }}>
          <LiveStat label={t('train.session.setsLabel')} value={`${completedSets}/${totalSets}`} />
          <LiveStat
            label={t('train.session.volumeLabel')}
            value={`${Math.round(totalVolume)}`}
            unit={t('common.kg')}
          />
          <LiveStat label={t('train.session.exercisesLabel')} value={`${draft.exercises.length}`} />
        </View>

        {/* Overall progress bar */}
        {totalSets > 0 ? (
          <View className="mt-4">
            <View className="h-2 rounded-full bg-bg-elevated overflow-hidden">
              <LinearGradient
                colors={['#FF8A2B', '#FF4D2E', '#FF2D55'] as unknown as GradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: '100%',
                  width: `${Math.max(4, progress * 100)}%`,
                  borderRadius: 999,
                }}
              />
            </View>
            <Text className="text-ink-muted text-[10px] font-bold mt-1.5 text-right">
              {Math.round(progress * 100)}%
            </Text>
          </View>
        ) : null}
      </View>

      <FlatList<WorkoutExerciseDraft>
        data={draft.exercises}
        keyExtractor={(e) => e.id}
        contentContainerClassName="px-5 pb-56"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <View className="items-center mt-12">
            <View className="w-20 h-20 rounded-3xl bg-bg-raised border border-border items-center justify-center mb-4">
              <Icon name="dumbbell" size={28} color="#FF4D2E" strokeWidth={2} />
            </View>
            <Text className="text-ink text-lg font-extrabold tracking-tight">
              {t('train.session.noExercises')}
            </Text>
            <Text className="text-ink-subtle text-sm mt-1 mb-5 text-center max-w-[260px]">
              {t('train.session.pickFromLib')}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <ExerciseCard
            item={item}
            index={index + 1}
            info={names.data?.get(item.exercise_id)}
            onAddSet={() => addSet(item.id)}
            onCompleteSet={(setId) => completeSet(item.id, setId)}
            onUpdateSet={(setId, patch) => updateSet(item.id, setId, patch)}
            onRemoveSet={(setId) => removeSet(item.id, setId)}
            onAcceptSuggestion={(s) => acceptSuggestion(item.id, s)}
          />
        )}
      />

      {/* Docked above the footer: one-time Spotify prompt + now-playing bar. */}
      <View className="absolute left-0 right-0 bottom-0">
        <SpotifyConnectPrompt />
        <MiniPlayer />
        <View
          className="px-5 pb-6 pt-3"
          style={{
            backgroundColor: 'rgba(11,11,15,0.95)',
            borderTopWidth: 1,
            borderColor: '#21212B',
          }}
        >
          <Button
            label={t('train.session.finish')}
            icon="check"
            onPress={() => {
              finish();
              safeBack();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Exercise card
// ---------------------------------------------------------------------------

function ExerciseCard({
  item,
  index,
  info,
  onAddSet,
  onCompleteSet,
  onUpdateSet,
  onRemoveSet,
  onAcceptSuggestion,
}: {
  item: WorkoutExerciseDraft;
  index: number;
  info: ExerciseName | undefined;
  onAddSet: () => void;
  onCompleteSet: (setId: string) => void;
  onUpdateSet: (setId: string, patch: Partial<SetDraft>) => void;
  onRemoveSet: (setId: string) => void;
  onAcceptSuggestion: (s: NextSessionSuggestion) => void;
}) {
  const { t } = useTranslation();
  const c = muscleVisual(info?.muscleGroup);
  const imageUrl = info ? exerciseImageUrl(info.nameEn, 0, info.muscleGroup) : null;
  const done = item.sets.filter((s) => s.completed).length;
  const allDone = item.sets.length > 0 && done === item.sets.length;

  const onLongPressSet = (s: SetDraft) =>
    Alert.alert(t('train.session.removeSetTitle', 'Remove set?'), undefined, [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('common.delete', 'Delete'),
        style: 'destructive',
        onPress: () => onRemoveSet(s.id),
      },
    ]);

  return (
    <Card padded={false}>
      {/* Header */}
      <View
        className="px-3 py-3 flex-row items-center border-b border-border"
        style={{ borderLeftWidth: 3, borderLeftColor: c.from }}
      >
        {/* Muscle-colored thumbnail */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            overflow: 'hidden',
            marginRight: 12,
            borderWidth: 1,
            borderColor: `${c.from}40`,
          }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <LinearGradient
              colors={[c.from, c.to] as unknown as GradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name={c.icon} size={20} color="#FFFFFF" />
            </LinearGradient>
          )}
          <View
            style={{
              position: 'absolute',
              top: 3,
              left: 3,
              backgroundColor: 'rgba(0,0,0,0.55)',
              paddingHorizontal: 5,
              borderRadius: 5,
            }}
          >
            <Text className="text-white font-extrabold" style={{ fontSize: 9 }}>
              {index}
            </Text>
          </View>
        </View>

        <View className="flex-1 mr-2">
          <Text className="text-ink font-extrabold tracking-tight" numberOfLines={1}>
            {info?.name ??
              t('train.session.exerciseN', { n: index, defaultValue: `Exercise ${index}` })}
          </Text>
          {info?.muscleGroup ? (
            <Text
              className="text-[10px] font-bold uppercase mt-0.5"
              style={{ color: c.from, letterSpacing: 0.6 }}
            >
              {info.muscleGroup}
            </Text>
          ) : null}
        </View>

        {/* Per-exercise completion badge */}
        <View
          className="rounded-full px-2.5 py-1 flex-row items-center"
          style={{
            backgroundColor: allDone ? 'rgba(46,230,166,0.15)' : 'rgba(255,255,255,0.04)',
            borderWidth: 1,
            borderColor: allDone ? 'rgba(46,230,166,0.4)' : '#21212B',
          }}
        >
          {allDone ? <Icon name="check" size={11} color="#2EE6A6" strokeWidth={3} /> : null}
          <Text
            className="text-[11px] font-extrabold"
            style={{ color: allDone ? '#2EE6A6' : '#B4B4C2', marginLeft: allDone ? 4 : 0 }}
          >
            {done}/{item.sets.length}
          </Text>
        </View>
      </View>

      <View className="px-4 py-2">
        <View className="px-0 pt-3">
          <SuggestionCard exerciseId={item.exercise_id} onAccept={onAcceptSuggestion} />
        </View>

        {/* Column headers */}
        <View className="flex-row items-center py-1.5 mb-1">
          <Text
            className="w-8 text-ink-muted text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {t('train.session.setHeader')}
          </Text>
          <Text
            className="flex-1 text-center text-ink-muted text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {t('train.session.weightHeader')}
          </Text>
          <Text
            className="flex-1 text-center text-ink-muted text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {t('train.session.repsHeader')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {item.sets.map((s) => (
          <SetRow
            key={s.id}
            set={s}
            accent={c.from}
            onComplete={() => onCompleteSet(s.id)}
            onChangeWeight={(weight_kg) => onUpdateSet(s.id, { weight_kg })}
            onChangeReps={(reps) => onUpdateSet(s.id, { reps })}
            onLongPress={() => onLongPressSet(s)}
          />
        ))}

        <View className="h-2" />
        <Button
          label={t('train.session.addSet')}
          variant="secondary"
          size="sm"
          icon="plus"
          onPress={onAddSet}
        />
        <View className="h-2" />
      </View>
    </Card>
  );
}

function SetRow({
  set: s,
  accent,
  onComplete,
  onChangeWeight,
  onChangeReps,
  onLongPress,
}: {
  set: SetDraft;
  accent: string;
  onComplete: () => void;
  onChangeWeight: (n: number) => void;
  onChangeReps: (n: number) => void;
  onLongPress: () => void;
}) {
  const cell = s.completed ? { backgroundColor: 'rgba(46,230,166,0.06)' } : undefined;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      className="flex-row items-center py-1.5 border-t border-border/50 rounded-xl"
      style={cell}
    >
      <Text
        className="w-8 font-extrabold text-center"
        style={{
          fontFamily: monoFamily,
          fontVariant: ['tabular-nums'],
          color: s.completed ? '#2EE6A6' : '#74748A',
        }}
      >
        {s.set_index}
      </Text>

      {/* Weight cell */}
      <View className="flex-1 px-1">
        <NumCell
          value={s.weight_kg}
          suffix="kg"
          completed={s.completed}
          accent={accent}
          onChange={onChangeWeight}
        />
      </View>

      {/* Reps cell */}
      <View className="flex-1 px-1">
        <NumCell
          value={s.reps}
          completed={s.completed}
          accent={accent}
          onChange={onChangeReps}
          integer
        />
      </View>

      {/* Complete toggle */}
      <Pressable
        onPress={onComplete}
        hitSlop={8}
        className="items-center justify-center"
        style={{ width: 40 }}
      >
        <View
          className="w-9 h-9 rounded-full items-center justify-center"
          style={
            s.completed
              ? { backgroundColor: '#2EE6A6' }
              : { backgroundColor: '#14141C', borderWidth: 1, borderColor: '#34343F' }
          }
        >
          <Icon
            name="check"
            size={15}
            color={s.completed ? '#0A0A0F' : '#74748A'}
            strokeWidth={2.8}
          />
        </View>
      </Pressable>
    </Pressable>
  );
}

function NumCell({
  value,
  onChange,
  completed,
  accent,
  suffix,
  integer,
}: {
  value: number;
  onChange: (n: number) => void;
  completed: boolean;
  accent: string;
  suffix?: string;
  integer?: boolean;
}) {
  return (
    <View
      className="flex-row items-baseline justify-center rounded-xl px-2 py-2"
      style={{
        backgroundColor: completed ? 'transparent' : '#14141C',
        borderWidth: 1,
        borderColor: completed ? 'transparent' : '#21212B',
      }}
    >
      <TextInput
        value={value ? String(value) : ''}
        onChangeText={(txt) => {
          const cleaned = integer ? txt.replace(/[^\d]/g, '') : txt.replace(/[^\d.]/g, '');
          onChange(Number(cleaned) || 0);
        }}
        editable={!completed}
        keyboardType={integer ? 'number-pad' : 'numeric'}
        placeholder="0"
        placeholderTextColor="#52525B"
        selectTextOnFocus
        className="text-center"
        style={{
          fontFamily: monoFamily,
          fontVariant: ['tabular-nums'],
          fontSize: 16,
          fontWeight: '800',
          color: completed ? '#F4F4F7' : accent,
          minWidth: 28,
          padding: 0,
        }}
      />
      {suffix ? <Text className="text-ink-muted text-[10px] font-bold ml-1">{suffix}</Text> : null}
    </View>
  );
}

function LiveStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View className="flex-1 bg-bg-raised border border-border rounded-2xl px-3 py-3">
      <Text
        className="text-ink-muted text-[10px] font-extrabold uppercase"
        style={{ letterSpacing: 1.2 }}
      >
        {label}
      </Text>
      <View className="flex-row items-baseline mt-1">
        <Text
          className="text-ink text-xl font-extrabold tracking-tight"
          style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
        {unit ? <Text className="text-ink-muted text-xs ml-1">{unit}</Text> : null}
      </View>
    </View>
  );
}
