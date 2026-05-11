import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Header, Screen, Spinner } from '@features/shared';
import { supabase } from '@lib/supabase/client';
import { useIsAdmin } from '../hooks/useIsAdmin';

interface Row {
  user_id: string;
  day: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export function AICostsScreen() {
  const { t } = useTranslation();
  const admin = useIsAdmin();
  const q = useQuery<Row[]>({
    enabled: admin.data === true,
    queryKey: ['ai-costs-daily'],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data, error } = await supabase
        .from('ai_costs_by_user_daily')
        .select('*')
        .gte('day', since.toISOString())
        .order('cost_usd', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (admin.isPending) return <Spinner />;
  if (!admin.data) {
    return (
      <Screen>
        <Header title="AI costs" showBack />
        <Text className="text-ink-subtle text-center mt-12">
          {t('admin.notAdmin', 'Admin access only.')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View className="px-5 pt-4">
        <Header title="AI costs (7 days)" showBack />
      </View>
      {q.isPending ? (
        <Spinner />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(r, i) => `${r.user_id}-${r.day}-${i}`}
          contentContainerClassName="px-5 pb-28"
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <Text className="text-ink-subtle text-center mt-12">No AI usage yet.</Text>
          }
          renderItem={({ item }) => (
            <View className="bg-bg-raised border border-border rounded-2xl p-4">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest">
                    {new Date(item.day).toLocaleDateString()}
                  </Text>
                  <Text className="text-ink text-xs mt-1" numberOfLines={1} ellipsizeMode="middle">
                    {item.user_id}
                  </Text>
                </View>
                <Text className="text-accent text-base font-bold">
                  ${Number(item.cost_usd).toFixed(4)}
                </Text>
              </View>
              <Text className="text-ink-subtle text-xs mt-2">
                {item.calls} calls · {item.input_tokens} in · {item.output_tokens} out
              </Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}
