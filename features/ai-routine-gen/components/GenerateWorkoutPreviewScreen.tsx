import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AIReasoningCard, Button, Card, Header, Icon, Screen } from '@features/shared';
import { useSession } from '@features/auth';
import { useStartWorkout, useWorkoutSessionStore } from '@features/workouts';
import type { WorkoutExercise } from '@lib/llm';
import { useDraftRoutineStore } from '../store';
import { saveWorkoutAsTemplate } from '../repositories/routines';
import { useGenerateWorkout } from '../hooks/useGenerateWorkout';

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

  if (!draft || draft.kind !== 'workout') {
    return (
      <Screen>
        <Header title={t('routines.preview', 'Preview')} showBack />
        <Text className="text-ink-subtle">{t('routines.noDraft', 'No draft to preview.')}</Text>
      </Screen>
    );
  }
  const w = draft.workout;

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
    <Screen scroll>
      <Header title={w.name} showBack />
      <Text className="text-ink-subtle text-sm mb-1">
        {w.focus} · ~{w.estimated_duration_min} {t('common.min', 'min')}
      </Text>

      <View className="h-3" />

      <AIReasoningCard coachName={t('ai.coach.title', 'AI Coach')} reasoning={w.reasoning} />

      {w.warm_up_protocol ? (
        <Card>
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-2">
            {t('routines.warmup', 'WARM-UP')}
          </Text>
          <Text className="text-ink leading-6">{w.warm_up_protocol}</Text>
        </Card>
      ) : null}

      <View className="h-3" />

      {w.exercises.map((ex, i) => (
        <ExerciseRow
          key={`${ex.name}-${i}`}
          ex={ex}
          index={i}
          total={w.exercises.length}
          onPatch={(p) => patch(i, p)}
          onRemove={() => remove(i)}
          onMoveUp={i > 0 ? () => reorder(i, i - 1) : undefined}
          onMoveDown={i < w.exercises.length - 1 ? () => reorder(i, i + 1) : undefined}
        />
      ))}

      {w.cool_down_protocol ? (
        <Card>
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-2">
            {t('routines.cooldown', 'COOL-DOWN')}
          </Text>
          <Text className="text-ink leading-6">{w.cool_down_protocol}</Text>
        </Card>
      ) : null}

      <View className="h-6" />
      <View style={{ gap: 8 }}>
        <Button
          label={t('routines.regen', 'Regenerate')}
          icon="sparkles"
          variant="secondary"
          onPress={onRegenerate}
          loading={regenLoading}
        />
        <Button
          label={t('routines.saveTemplate', 'Save as routine')}
          icon="bookmark"
          variant="secondary"
          onPress={onSave}
          loading={saving}
        />
        <Button label={t('routines.startNow', 'Start now')} icon="play" onPress={onStart} />
      </View>
    </Screen>
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
  total: number;
  onPatch: (p: Partial<WorkoutExercise>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable onPress={() => setExpanded((e) => !e)}>
      <Card className="mb-2.5">
        <View className="flex-row items-center">
          <View className="w-8 h-8 rounded-xl bg-bg-subtle border border-border items-center justify-center mr-3">
            <Text className="text-ink-subtle text-xs font-bold">{index + 1}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-ink font-bold" numberOfLines={1}>
              {ex.is_warmup ? `🔥 ${ex.name}` : ex.name}
            </Text>
            <Text className="text-ink-subtle text-xs">
              {ex.sets} × {ex.rep_scheme} @ RPE {ex.target_rpe} · {ex.rest_seconds}s rest
            </Text>
          </View>
          <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={18} color="#A1A1AA" />
        </View>
        {expanded ? (
          <View className="mt-3 pt-3 border-t border-border" style={{ gap: 6 }}>
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
              onChange={(v) =>
                onPatch({ target_rpe: Math.max(1, Math.min(10, parseFloat(v) || 7)) })
              }
              keyboardType="numeric"
            />
            <RowInput
              label={t('routines.rest', 'Rest (s)')}
              value={String(ex.rest_seconds)}
              onChange={(v) => onPatch({ rest_seconds: Math.max(0, parseInt(v, 10) || 60) })}
              keyboardType="number-pad"
            />
            {ex.notes ? <Text className="text-ink-subtle text-xs">📝 {ex.notes}</Text> : null}
            <View className="flex-row mt-2" style={{ gap: 6 }}>
              {onMoveUp ? (
                <Button
                  label="↑"
                  size="sm"
                  variant="secondary"
                  onPress={onMoveUp}
                  fullWidth={false}
                />
              ) : null}
              {onMoveDown ? (
                <Button
                  label="↓"
                  size="sm"
                  variant="secondary"
                  onPress={onMoveDown}
                  fullWidth={false}
                />
              ) : null}
              <View className="flex-1" />
              <Button
                label={t('common.delete', 'Delete')}
                size="sm"
                variant="danger"
                icon="trash"
                onPress={onRemove}
                fullWidth={false}
              />
            </View>
          </View>
        ) : null}
        <View />
      </Card>
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
    <View className="flex-row items-center">
      <Text className="w-20 text-ink-subtle text-xs font-semibold">{label}</Text>
      <View className="flex-1 bg-bg-subtle border border-border rounded-xl px-3 py-2">
        <TextInput
          value={value}
          onChangeText={onChange}
          className="text-ink text-sm"
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}
