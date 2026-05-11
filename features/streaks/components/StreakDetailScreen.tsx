import { Alert, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Button, Header, Screen } from '@features/shared';
import { useResetStreak, useStreak, useStreakEvents } from '../hooks/useStreak';
import { HeatmapGrid } from './HeatmapGrid';

export function StreakDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: streak } = useStreak();
  const { data: events } = useStreakEvents(180);
  const reset = useResetStreak();

  const onReset = () => {
    Alert.alert(
      t('streaks.resetConfirmTitle', { defaultValue: 'Reset streak?' }),
      t('streaks.resetConfirmBody', {
        defaultValue: 'This sets your current streak to zero. Longest streak is preserved.',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('streaks.resetConfirmCta', { defaultValue: 'Reset' }),
          style: 'destructive',
          onPress: () => reset.mutate(),
        },
      ],
    );
  };

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-2">
        <Header title={t('streaks.title', { defaultValue: 'Streak' })} showBack />
      </View>
      <View className="px-5 pb-10">
        <View className="items-center mt-2 mb-6">
          <Text
            className="text-ink font-extrabold tracking-tight"
            style={{ fontSize: 72, lineHeight: 78 }}
          >
            {streak?.current_streak ?? 0}
          </Text>
          <Text className="text-ink-muted text-sm font-bold mt-1">
            {t('streaks.currentStreak', { defaultValue: 'Current streak' })}
          </Text>
          <Text className="text-ink-subtle text-xs mt-2">
            {t('streaks.longestLabel', { defaultValue: 'Longest' })}: {streak?.longest_streak ?? 0}{' '}
            · {t('streaks.totalLogged', { defaultValue: 'Total workouts' })}:{' '}
            {streak?.total_workouts_logged ?? 0}
          </Text>
        </View>

        <View className="bg-bg-raised rounded-3xl border border-border p-4 mb-4">
          <Text
            className="text-ink-muted text-[10px] font-extrabold uppercase mb-3"
            style={{ letterSpacing: 1.2 }}
          >
            {t('streaks.last6Months', { defaultValue: 'Last 6 months' })}
          </Text>
          <HeatmapGrid events={events ?? []} />
        </View>

        <View className="bg-bg-raised rounded-3xl border border-border p-4 mb-4 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-ink font-extrabold tracking-tight">
              {t('streaks.scheduleTitle', { defaultValue: 'Training schedule' })}
            </Text>
            <Text className="text-ink-subtle text-xs mt-0.5">
              {streak?.is_flexible_schedule
                ? t('streaks.flexibleMode', {
                    defaultValue: 'Flexible — count workouts, not days',
                  })
                : t('streaks.scheduledSummary', {
                    defaultValue: '{{count}} day/week',
                    count: streak?.current_week_target ?? 3,
                  })}
            </Text>
          </View>
          <Button
            label={t('streaks.adjust', { defaultValue: 'Adjust' })}
            size="sm"
            variant="secondary"
            onPress={() => router.push('/streaks/schedule' as never)}
          />
        </View>

        <Button
          label={t('streaks.resetStreak', { defaultValue: 'Reset streak' })}
          variant="ghost"
          onPress={onReset}
        />
      </View>
    </Screen>
  );
}
