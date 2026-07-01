import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppError, toAppError } from '@lib/supabase/errors';
import { Icon } from './Icon';

interface Props {
  error: unknown;
}

export function ErrorMessage({ error }: Props) {
  const { t } = useTranslation();
  const appErr = error instanceof AppError ? error : toAppError(error);
  return (
    <View className="flex-row items-start bg-danger/10 border border-danger/40 rounded-2xl px-4 py-3">
      <View className="mt-0.5 mr-2">
        <Icon name="x" size={16} color="#FF4D6D" strokeWidth={2.4} />
      </View>
      <Text className="text-danger text-sm flex-1 leading-5 font-medium">{t(appErr.i18nKey)}</Text>
    </View>
  );
}
