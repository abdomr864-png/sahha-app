import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { storage } from '@lib/offline';
import { Icon } from '@features/shared';
import type { DeloadRecommendation } from '../recovery';

const DISMISS_KEY = 'sahha.deload.dismissed.v1';

function todayKey(): string {
  return new Date().toDateString();
}

/**
 * "Deload recommended" card. Shown when the recovery system flags either a
 * spiking acute:chronic workload ratio or a multi-day suppressed-score streak.
 * Dismissible — the dismissal is remembered for the rest of the day so it
 * doesn't nag, and naturally reappears tomorrow if still warranted.
 */
export function DeloadCard({ rec }: { rec: DeloadRecommendation }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => storage.getString(DISMISS_KEY) === todayKey());

  if (!rec.recommend || dismissed) return null;

  const dismiss = () => {
    storage.setString(DISMISS_KEY, todayKey());
    setDismissed(true);
  };

  const reason =
    rec.reason === 'acwr'
      ? t('recovery.deloadReasonLoad', {
          defaultValue:
            'Your training load has spiked well above your recent baseline — a lighter week now lowers injury risk.',
        })
      : t('recovery.deloadReasonSuppressed', {
          count: rec.suppressedDays,
          defaultValue:
            'Your recovery has been low for {{count}} days straight — your body is asking for a lighter week.',
        });

  return (
    <View
      className="rounded-2xl px-4 py-3.5 mb-4 border"
      style={{
        backgroundColor: 'rgba(245,158,11,0.08)',
        borderColor: 'rgba(245,158,11,0.40)',
      }}
    >
      <View className="flex-row items-center mb-1.5">
        <View className="w-8 h-8 rounded-xl items-center justify-center bg-warning/15 mr-3">
          <Icon name="heart" size={15} color="#F59E0B" />
        </View>
        <Text className="flex-1 text-ink text-[15px] font-extrabold">
          {t('recovery.deloadTitle', { defaultValue: 'Deload recommended' })}
        </Text>
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss', { defaultValue: 'Dismiss' })}
        >
          <Icon name="x" size={18} color="#B4B4C2" />
        </Pressable>
      </View>
      <Text className="text-ink-subtle text-[12.5px]" style={{ lineHeight: 18 }}>
        {reason}
      </Text>
    </View>
  );
}
