import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Icon } from '@features/shared';
import { useStreak, toStreakView } from '../hooks/useStreak';

const DOW_LABELS = [
  'streaks.weekday.sun',
  'streaks.weekday.mon',
  'streaks.weekday.tue',
  'streaks.weekday.wed',
  'streaks.weekday.thu',
  'streaks.weekday.fri',
  'streaks.weekday.sat',
] as const;

/**
 * Compact streak card for the home screen. Replaces the hardcoded flame chip.
 * Tap → /streaks (detail screen with heatmap).
 */
export function StreakCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: streak } = useStreak();
  const view = toStreakView(streak);

  if (!view) {
    // First-launch / no-auth: a quiet placeholder so home layout doesn't jump.
    return null;
  }

  const nextLabel = view.nextSessionDate
    ? t(DOW_LABELS[view.nextSessionDate.getDay()]!, { defaultValue: '' })
    : '';

  return (
    <Pressable
      onPress={() => router.push('/streaks' as never)}
      accessibilityRole="button"
      accessibilityLabel={t('streaks.openDetail', { defaultValue: 'Open streak details' })}
      className="bg-bg-raised rounded-3xl p-4 mb-4 border border-border"
    >
      <View className="flex-row items-center">
        <View className="w-11 h-11 rounded-2xl bg-bg-subtle items-center justify-center mr-3 border border-border">
          <Icon name="flame" size={22} color="#F97316" />
        </View>
        <View className="flex-1">
          <Text
            className="text-ink-muted text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: 1.2 }}
          >
            {t('streaks.currentStreak', { defaultValue: 'Current streak' })}
          </Text>
          <View className="flex-row items-baseline">
            <Text className="text-ink text-3xl font-extrabold tracking-tight">{view.current}</Text>
            <Text className="text-ink-muted text-sm font-bold ml-1.5">
              {t('streaks.workouts', { defaultValue: 'workouts' })}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={16} color="#B4B4C2" />
      </View>

      <View className="mt-3">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-ink-subtle text-xs">
            {t('streaks.thisWeek', { defaultValue: 'This week' })}: {view.weekCompletions}/
            {view.weekTarget}
          </Text>
          <View className="flex-row items-center">
            <Icon name="sparkles" size={11} color="#A5B4FC" />
            <Text className="text-ink-subtle text-xs ml-1">
              {view.freezesAvailable}{' '}
              {t('streaks.freezeShort', { defaultValue: 'freeze available' })}
            </Text>
          </View>
        </View>
        <WeekRingsBar weekCompletions={view.weekCompletions} weekTarget={view.weekTarget} />
        {view.isRecoveryWeek ? (
          <Text className="text-warning text-xs mt-2 font-bold">
            {t('streaks.recoveryWeekShort', {
              defaultValue: 'Recovery week — your streak is safe',
            })}
          </Text>
        ) : nextLabel ? (
          <Text className="text-ink-subtle text-xs mt-2">
            {t('streaks.nextSession', { defaultValue: 'Next session' })}: {nextLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function WeekRingsBar({
  weekCompletions,
  weekTarget,
}: {
  weekCompletions: number;
  weekTarget: number;
}) {
  const total = Math.max(1, Math.min(7, weekTarget));
  const done = Math.max(0, Math.min(total, weekCompletions));
  const cells = Array.from({ length: total }, (_, i) => i < done);
  return (
    <View className="flex-row" style={{ gap: 4 }}>
      {cells.map((isDone, i) => (
        <View
          key={i}
          className={`flex-1 h-2 rounded-full ${isDone ? 'bg-success' : 'bg-bg-subtle'}`}
        />
      ))}
    </View>
  );
}

/**
 * Slim recovery-week banner. Mount on home above the rest of the content when
 * a user is mid-recovery week — tone is encouraging, never shaming.
 */
export function RecoveryWeekBanner() {
  const { t } = useTranslation();
  const { data: streak } = useStreak();
  if (!streak?.is_recovery_week) return null;
  return (
    <View
      className="rounded-2xl px-4 py-3 mb-3 flex-row items-center border"
      style={{
        backgroundColor: 'rgba(245,158,11,0.08)',
        borderColor: 'rgba(245,158,11,0.35)',
      }}
    >
      <View className="w-8 h-8 rounded-xl items-center justify-center bg-warning/15 mr-3">
        <Icon name="heart" size={14} color="#F59E0B" />
      </View>
      <Text className="flex-1 text-ink text-sm font-bold">
        {t('streaks.recoveryWeekBanner', {
          defaultValue: 'Recovery week — let’s get back on track. Your streak is safe.',
        })}
      </Text>
    </View>
  );
}
