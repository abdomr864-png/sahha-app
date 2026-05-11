import { Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon, IconButton, Screen, useSafeBack } from '@features/shared';
import {
  useActiveSession,
  useFinishWorkout,
  useWorkoutSessionStore,
  type WorkoutExerciseDraft,
} from '@features/workouts';
import { SuggestionCard } from '@features/progression';
import type { NextSessionSuggestion } from '@features/progression';

const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export default function Session() {
  const { t } = useTranslation();
  const _router = useRouter();
  const safeBack = useSafeBack('/routines');
  const draft = useActiveSession();
  const finish = useFinishWorkout();
  const discard = useWorkoutSessionStore((s) => s.discard);
  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const completeSet = useWorkoutSessionStore((s) => s.completeSet);
  const updateSet = useWorkoutSessionStore((s) => s.updateSet);

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
            <Icon name="x" size={28} color="#A1A1AA" />
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

  return (
    <Screen padded={false}>
      {/* Header */}
      <View className="px-5 pt-2 mb-5">
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
          {t('train.session.title')}
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
      </View>

      <FlatList<WorkoutExerciseDraft>
        data={draft.exercises}
        keyExtractor={(e) => e.id}
        contentContainerClassName="px-5 pb-40"
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
        renderItem={({ item }) => (
          <Card padded={false}>
            <View className="px-4 py-3 border-b border-border flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-bg-elevated items-center justify-center mr-3">
                <Icon name="dumbbell" size={16} color="#FF4D2E" />
              </View>
              <Text className="text-ink font-extrabold flex-1 tracking-tight">
                {item.exercise_id.slice(0, 8)}…
              </Text>
              <Text className="text-ink-muted text-[11px] font-bold">
                {t('train.session.completedOf', {
                  done: item.sets.filter((s) => s.completed).length,
                  total: item.sets.length,
                })}
              </Text>
            </View>
            <View className="px-4 py-2">
              <View className="px-0 pt-3">
                <SuggestionCard
                  exerciseId={item.exercise_id}
                  onAccept={(s) => acceptSuggestion(item.id, s)}
                />
              </View>
              <View className="flex-row items-center py-1.5 mb-1">
                <Text
                  className="w-8 text-ink-muted text-[10px] font-extrabold uppercase"
                  style={{ letterSpacing: 1.2 }}
                >
                  {t('train.session.setHeader')}
                </Text>
                <Text
                  className="flex-1 text-ink-muted text-[10px] font-extrabold uppercase"
                  style={{ letterSpacing: 1.2 }}
                >
                  {t('train.session.weightHeader')}
                </Text>
                <Text
                  className="flex-1 text-ink-muted text-[10px] font-extrabold uppercase"
                  style={{ letterSpacing: 1.2 }}
                >
                  {t('train.session.repsHeader')}
                </Text>
                <View style={{ width: 36 }} />
              </View>
              {item.sets.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => completeSet(item.id, s.id)}
                  className={`flex-row items-center py-2.5 border-t border-border/50 ${
                    s.completed ? 'bg-success/5' : ''
                  }`}
                >
                  <Text
                    className="w-8 text-ink-subtle font-bold"
                    style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
                  >
                    {s.set_index}
                  </Text>
                  <Text
                    className="flex-1 text-ink font-extrabold tracking-tight text-base"
                    style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
                  >
                    {s.weight_kg ?? 0} kg
                  </Text>
                  <Text
                    className="flex-1 text-ink font-extrabold tracking-tight text-base"
                    style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
                  >
                    {s.reps ?? 0}
                  </Text>
                  <View
                    className={`w-9 h-9 rounded-full items-center justify-center ${
                      s.completed ? 'bg-success' : 'bg-bg-subtle border border-border'
                    }`}
                  >
                    <Icon
                      name="check"
                      size={14}
                      color={s.completed ? '#0B0B0F' : '#A1A1AA'}
                      strokeWidth={2.6}
                    />
                  </View>
                </Pressable>
              ))}
              <View className="h-2" />
              <Button
                label={t('train.session.addSet')}
                variant="secondary"
                size="sm"
                icon="plus"
                onPress={() => addSet(item.id)}
              />
              <View className="h-2" />
            </View>
          </Card>
        )}
      />

      <View
        className="absolute left-0 right-0 bottom-0 px-5 pb-6 pt-3"
        style={{
          backgroundColor: 'rgba(11,11,15,0.95)',
          borderTopWidth: 1,
          borderColor: '#27272F',
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
    </Screen>
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
