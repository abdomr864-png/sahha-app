import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Header, Screen } from '@features/shared';
import { Conversation } from '@features/ai-coach';

export default function ConversationScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen padded={false}>
      <View className="px-5 pt-4">
        <Header title={t('ai.coach.title', 'AI Coach')} showBack />
      </View>
      <Conversation conversationId={id} />
    </Screen>
  );
}
