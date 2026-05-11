// Highlighted card displaying the AI's reasoning for a generated workout or
// program. The chips below the quote surface the specific data points the AI
// referenced — sleep, recent training, nutrition, etc.

import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

interface DataChip {
  icon: '💤' | '🏋️' | '🍽' | '⚡' | '😴' | '📈';
  label: string;
}

interface Props {
  coachName: string;
  reasoning: string;
  chips?: DataChip[];
}

export function AIReasoningCard({ coachName, reasoning, chips = [] }: Props) {
  const { t } = useTranslation();
  return (
    <View
      className="bg-bg-raised border border-accent/40 rounded-3xl p-5 mb-4"
      style={{
        shadowColor: '#FF4D2E',
        shadowOpacity: 0.18,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <View className="flex-row items-center mb-3">
        <View className="w-9 h-9 rounded-full bg-accent/15 border border-accent/30 items-center justify-center mr-3">
          <Icon name="sparkles" size={18} color="#FF4D2E" />
        </View>
        <View className="flex-1">
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
            {t('ai.coach.title').toUpperCase()}
          </Text>
          <Text className="text-ink text-base font-bold">{coachName}</Text>
        </View>
      </View>
      <Text className="text-ink text-base leading-6 mb-3">{reasoning}</Text>
      {chips.length ? (
        <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {chips.map((c, i) => (
            <View
              key={`${c.icon}-${i}`}
              className="flex-row items-center bg-bg-subtle border border-border rounded-full px-3 py-1.5"
            >
              <Text className="text-sm mr-1.5">{c.icon}</Text>
              <Text className="text-ink-subtle text-xs font-semibold">{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
