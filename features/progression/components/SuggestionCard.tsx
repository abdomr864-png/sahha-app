import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@features/shared';
import { useExerciseSuggestion, useResolveSuggestion } from '../hooks/useSuggestion';
import type { NextSessionSuggestion } from '../schemas';

interface Props {
  exerciseId: string;
  onAccept: (s: NextSessionSuggestion) => void;
}

/**
 * In-session "Suggested today" card. Renders above an exercise's set logger
 * when compute-progression has produced an unconsumed suggestion. PR-attempt
 * suggestions render with a distinct treatment.
 */
export function SuggestionCard({ exerciseId, onAccept }: Props) {
  const { t } = useTranslation();
  const { data: suggestion } = useExerciseSuggestion(exerciseId);
  const resolve = useResolveSuggestion(exerciseId);

  if (!suggestion) return null;

  const isPR = suggestion.is_pr_attempt;
  const weight = suggestion.suggested_weight_kg;
  const reps = suggestion.suggested_reps;
  const sets = suggestion.suggested_sets;

  return (
    <View
      className="rounded-2xl p-3.5 mb-3 border"
      style={{
        backgroundColor: isPR ? 'rgba(124,58,237,0.10)' : 'rgba(255,77,46,0.08)',
        borderColor: isPR ? 'rgba(124,58,237,0.4)' : 'rgba(255,77,46,0.35)',
      }}
    >
      <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
        <Icon
          name={isPR ? 'sparkles' : 'trending'}
          size={13}
          color={isPR ? '#A78BFA' : '#FB923C'}
        />
        <Text
          className="text-[10px] font-extrabold uppercase"
          style={{
            letterSpacing: 1.2,
            color: isPR ? '#A78BFA' : '#FB923C',
          }}
        >
          {isPR
            ? t('progression.prTerritory', { defaultValue: 'PR territory' })
            : t('progression.suggestedToday', { defaultValue: 'Suggested today' })}
        </Text>
      </View>

      <View className="flex-row items-baseline mb-1">
        {sets != null && reps != null ? (
          <Text className="text-ink text-2xl font-extrabold tracking-tight">
            {sets} × {reps}
          </Text>
        ) : null}
        {weight != null && weight > 0 ? (
          <Text className="text-ink text-2xl font-extrabold tracking-tight ml-2">
            @ {weight} kg
          </Text>
        ) : null}
      </View>

      {suggestion.reasoning ? (
        <Text className="text-ink-subtle text-xs mb-3">{suggestion.reasoning}</Text>
      ) : null}

      <View className="flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={() => {
            resolve.mutate({ id: suggestion.id, decision: 'accepted' });
            onAccept(suggestion);
          }}
          className="flex-1 py-2.5 rounded-xl bg-accent items-center"
        >
          <Text className="text-accent-contrast font-bold">
            {isPR
              ? t('progression.tryWeight', {
                  defaultValue: 'Try {{w}}kg',
                  w: weight ?? '',
                })
              : t('progression.accept', { defaultValue: 'Accept' })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => resolve.mutate({ id: suggestion.id, decision: 'declined' })}
          className="flex-1 py-2.5 rounded-xl bg-bg-subtle border border-border items-center"
        >
          <Text className="text-ink font-bold">
            {t('progression.override', { defaultValue: 'Override' })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
