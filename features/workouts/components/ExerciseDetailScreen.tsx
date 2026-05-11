import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Header, MuscleSilhouette, Screen, Spinner } from '@features/shared';
import { useExerciseDetail } from '../hooks/useExerciseDetail';
import { useExerciseAlternatives } from '../hooks/useExerciseAlternatives';
import { useActiveSession } from '../hooks/useWorkoutSession';
import { useWorkoutSessionStore } from '../store';
import { VideoPlayer } from './VideoPlayer';

export function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const detail = useExerciseDetail(id);
  const alts = useExerciseAlternatives();
  const session = useActiveSession();
  const addExercise = useWorkoutSessionStore((s) => s.addExercise);
  const [showAlts, setShowAlts] = useState(false);

  if (detail.isLoading || !detail.data) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }
  const ex = detail.data;
  const lang = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';
  const name = lang === 'fr' ? ex.name_fr : lang === 'ar' ? ex.name_ar : ex.name_en;
  const instructions =
    lang === 'fr' ? ex.instructions_fr : lang === 'ar' ? ex.instructions_ar : ex.instructions_en;

  const onAddToSession = () => {
    addExercise(ex.id);
    router.replace('/session');
  };

  const onAddToRoutine = () => {
    // Placeholder: drop the exercise into a draft routine. The draft store is
    // shared between scanner and generator flows; here we just navigate there.
    router.push('/routines');
  };

  const onTryAlts = async () => {
    setShowAlts(true);
    if (!alts.data && !alts.loading) {
      try {
        await alts.fetch(ex.id, 'variety');
      } catch {
        /* surfaced via state */
      }
    }
  };

  return (
    <Screen scroll>
      <Header title={name} showBack />

      <VideoPlayer videoUrl={ex.video_url} photoUrl={ex.photo_url} />

      <View className="h-3" />

      <Card>
        <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-3">
          {t('exercise.muscles', 'MUSCLES')}
        </Text>
        <View className="items-center mb-4">
          <MuscleSilhouette
            primary={[ex.muscle_group]}
            secondary={ex.secondary_muscles}
            size={120}
          />
        </View>
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          <View className="bg-accent/15 border border-accent/30 rounded-full px-3 py-1">
            <Text className="text-accent text-xs font-bold">
              {t(`train.muscleGroups.${ex.muscle_group}`, ex.muscle_group)}
            </Text>
          </View>
          {ex.secondary_muscles.map((m) => (
            <View key={m} className="bg-bg-subtle border border-border rounded-full px-3 py-1">
              <Text className="text-ink-subtle text-xs font-bold">
                {t(`train.muscleGroups.${m}`, m)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View className="h-3" />

      {instructions ? (
        <Card>
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-2">
            {t('exercise.howTo', 'HOW TO')}
          </Text>
          <Text className="text-ink leading-6">{instructions}</Text>
        </Card>
      ) : null}

      <View className="h-3" />

      <View style={{ gap: 8 }}>
        {session ? (
          <Button
            label={t('exercise.addToSession', 'Add to current workout')}
            icon="plus"
            onPress={onAddToSession}
          />
        ) : (
          <Button
            label={t('exercise.addToRoutine', 'Add to routine')}
            icon="plus"
            onPress={onAddToRoutine}
          />
        )}
        <Button
          label={t('exercise.tryAlts', 'Try alternatives')}
          icon="sparkles"
          variant="secondary"
          onPress={onTryAlts}
        />
      </View>

      {showAlts ? (
        <View className="mt-4">
          {alts.loading ? <Spinner /> : null}
          {alts.errorCode ? (
            <Text className="text-danger text-sm">
              {t(`errors.ai.${alts.errorCode}`, alts.errorCode)}
            </Text>
          ) : null}
          {alts.data?.map((alt) => (
            <Card key={alt.name} className="mb-2">
              <Text className="text-ink font-bold">{alt.name}</Text>
              <Text className="text-ink-subtle text-sm mt-1">{alt.why}</Text>
              <Text className="text-ink-muted text-xs mt-1">{alt.equipment}</Text>
              {alt.matched_exercise_id ? (
                <View className="mt-2">
                  <Button
                    label={t('exercise.viewAlt', 'View')}
                    size="sm"
                    variant="secondary"
                    onPress={() => router.push(`/exercise/${alt.matched_exercise_id}`)}
                  />
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
