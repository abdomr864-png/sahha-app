import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Header, Screen } from '@features/shared';
import { ConversationList } from '@features/ai-coach';

export default function AICoachIndex() {
  const { t } = useTranslation();
  return (
    <Screen padded={false}>
      <View className="px-5 pt-4 pb-2">
        <Header title={t('ai.coach.title', 'AI Coach')} showBack />
      </View>
      <ConversationList />
    </Screen>
  );
}
