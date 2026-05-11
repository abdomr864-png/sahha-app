import { FlatList, Platform, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ErrorMessage, Icon, Spinner } from '@features/shared';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';

const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export function HistoryView() {
  const { t } = useTranslation();
  const q = useWorkoutHistory();

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorMessage error={q.error} />;

  const data = q.data ?? [];

  return (
    <FlatList
      data={data}
      keyExtractor={(w) => w.id}
      contentContainerClassName="px-5 pb-28"
      ItemSeparatorComponent={() => <View className="h-2.5" />}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View className="items-center mt-16">
          <View className="w-16 h-16 rounded-2xl bg-bg-raised border border-border items-center justify-center mb-4">
            <Icon name="history" size={26} color="#A1A1AA" />
          </View>
          <Text className="text-ink-subtle text-base text-center">{t('train.history.empty')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const date = new Date(item.started_at);
        const dateStr = date
          .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
          .toUpperCase();
        return (
          <View className="bg-bg-raised border border-border rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                {dateStr}
              </Text>
              <Icon name="check-circle" size={14} color="#34D399" />
            </View>
            <Text className="text-ink text-base font-bold mb-3">
              {item.name ?? t('train.history.untitled')}
            </Text>
            <View className="flex-row" style={{ gap: 16 }}>
              <View>
                <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                  {t('train.history.volumeLabel')}
                </Text>
                <Text
                  className="text-ink text-base font-extrabold mt-0.5"
                  style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
                >
                  {Math.round(item.total_volume_kg)}
                  <Text className="text-ink-muted text-xs font-medium"> kg</Text>
                </Text>
              </View>
            </View>
          </View>
        );
      }}
    />
  );
}
