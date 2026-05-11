import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';
import { ErrorMessage, Header, Screen, Spinner } from '@features/shared';

interface Row {
  id: string;
  exercise_id: string | null;
  feedback: string | null;
  created_at: string;
}

export function FormCheckHistoryScreen() {
  const { t } = useTranslation();
  const q = useQuery<Row[]>({
    queryKey: ['form-check-history'],
    queryFn: async () =>
      (await mapSb(
        supabase
          .from('ai_form_checks')
          .select('id, exercise_id, feedback, created_at')
          .order('created_at', { ascending: false })
          .limit(30),
      )) as Row[],
  });

  return (
    <Screen padded={false}>
      <View className="px-5 pt-4">
        <Header title={t('ai.formCheck.history', 'Form check history')} showBack />
      </View>
      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <ErrorMessage error={q.error} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerClassName="px-5 pb-28"
          ItemSeparatorComponent={() => <View className="h-2" />}
          ListEmptyComponent={
            <Text className="text-ink-subtle text-center mt-12">
              {t('ai.formCheck.empty', 'No form checks yet.')}
            </Text>
          }
          renderItem={({ item }) => {
            let parsed: { overall_score?: number } = {};
            try {
              parsed = item.feedback ? JSON.parse(item.feedback) : {};
            } catch {
              /* ignore */
            }
            return (
              <View className="bg-bg-raised border border-border rounded-2xl p-4">
                <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest">
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <Text className="text-ink text-base font-bold mt-1">
                  {t('ai.formCheck.score', 'Overall score')}: {parsed.overall_score ?? '–'}/10
                </Text>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
