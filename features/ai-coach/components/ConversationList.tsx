import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ErrorMessage, Icon, Spinner, Button } from '@features/shared';
import { useConversations } from '../hooks/useConversations';

export function ConversationList() {
  const { t } = useTranslation();
  const q = useConversations();

  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorMessage error={q.error} />;
  const data = q.data ?? [];

  return (
    <View className="flex-1">
      <View className="px-5 pb-4">
        <Button
          label={t('ai.coach.newChat', 'Start a new chat')}
          icon="plus"
          onPress={() => router.push('/ai-coach/new')}
        />
      </View>
      <FlatList
        data={data}
        keyExtractor={(c) => c.id}
        contentContainerClassName="px-5 pb-28"
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <View className="w-16 h-16 rounded-2xl bg-bg-raised border border-border items-center justify-center mb-4">
              <Icon name="sparkles" size={26} color="#A1A1AA" />
            </View>
            <Text className="text-ink-subtle text-base text-center">
              {t('ai.coach.empty', 'No conversations yet. Ask your AI coach anything.')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/ai-coach/${item.id}`)}
            className="bg-bg-raised border border-border rounded-2xl p-4"
          >
            <Text className="text-ink text-base font-semibold mb-1" numberOfLines={1}>
              {item.title ?? t('ai.coach.untitled', 'Conversation')}
            </Text>
            <Text className="text-ink-subtle text-xs">
              {new Date(item.last_message_at).toLocaleString()}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
