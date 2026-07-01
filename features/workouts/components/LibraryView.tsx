import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Chip, ErrorMessage, Icon, Input, Spinner } from '@features/shared';
import { useExerciseLibrary } from '../hooks/useExerciseLibrary';
import { useWorkoutSessionStore } from '../store';
import type { ExerciseFilter, ExerciseLite } from '../schemas';

const MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;

export function LibraryView() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<ExerciseFilter>({
    query: '',
    muscleGroup: null,
    equipment: null,
  });
  const lib = useExerciseLibrary(filter);
  const addExercise = useWorkoutSessionStore((s) => s.addExercise);
  const draft = useWorkoutSessionStore((s) => s.draft);

  const localizedName = (e: ExerciseLite) => {
    if (i18n.language === 'fr') return e.name_fr;
    if (i18n.language === 'ar') return e.name_ar;
    return e.name_en;
  };

  return (
    <View className="flex-1 px-5 pb-28">
      {!draft ? (
        <View className="mb-3">
          <Card tone="raised" className="border border-accent/30">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 items-center justify-center mr-3">
                <Icon name="play" size={14} color="#FF4D2E" />
              </View>
              <View className="flex-1">
                <Text className="text-ink text-sm font-bold">{t('train.library.startToAdd')}</Text>
                <Text className="text-ink-subtle text-xs mt-0.5">
                  {t('train.library.startToAddBody')}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/(tabs)')}
                className="px-3 py-2 rounded-xl bg-accent"
              >
                <Text className="text-accent-contrast text-xs font-bold tracking-wide">
                  {t('common.go')}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      ) : null}

      <Input
        placeholder={t('train.library.search')}
        value={filter.query}
        onChangeText={(query) => setFilter((f) => ({ ...f, query }))}
        icon="search"
      />

      <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
        <Chip
          label={t('train.library.all')}
          size="sm"
          active={!filter.muscleGroup}
          onPress={() => setFilter((f) => ({ ...f, muscleGroup: null }))}
        />
        {MUSCLES.map((m) => (
          <Chip
            key={m}
            label={t(`train.muscleGroups.${m}`, { defaultValue: m })}
            size="sm"
            active={filter.muscleGroup === m}
            onPress={() =>
              setFilter((f) => ({
                ...f,
                muscleGroup: f.muscleGroup === m ? null : (m as never),
              }))
            }
          />
        ))}
      </View>

      {lib.isPending ? <Spinner /> : null}
      {lib.isError ? <ErrorMessage error={lib.error} /> : null}

      <FlatList
        data={lib.data ?? []}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          !lib.isPending ? (
            <View className="items-center mt-10">
              <View className="w-14 h-14 rounded-2xl bg-bg-raised border border-border items-center justify-center mb-3">
                <Icon name="search" size={22} color="#B4B4C2" />
              </View>
              <Text className="text-ink-subtle text-center">{t('train.library.noResults')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => draft && addExercise(item.id)}
            className="flex-row items-center bg-bg-raised border border-border rounded-2xl p-3"
          >
            <View className="w-11 h-11 rounded-xl bg-bg-subtle border border-border items-center justify-center mr-3">
              <Icon name="dumbbell" size={18} color="#FF4D2E" />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-base font-semibold">{localizedName(item)}</Text>
              <Text className="text-ink-muted text-xs mt-0.5 uppercase tracking-wider">
                {t(`train.muscleGroups.${item.muscle_group}`, {
                  defaultValue: item.muscle_group,
                })}{' '}
                Â· {t(`train.equipment.${item.equipment}`, { defaultValue: item.equipment })}
              </Text>
            </View>
            <View
              className={`w-9 h-9 rounded-full items-center justify-center ${
                draft ? 'bg-accent' : 'bg-bg-subtle border border-border'
              }`}
            >
              <Icon name="plus" size={16} color={draft ? '#FFFFFF' : '#B4B4C2'} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
