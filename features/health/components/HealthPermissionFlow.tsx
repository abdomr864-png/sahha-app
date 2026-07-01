/**
 * Trilingual (FR/AR/EN), RTL-aware permission onboarding for health data.
 * Flow: explainer → request → (Android) Health Connect install fallback →
 * success / denied. Reads status from useHealthStore.
 *
 * A privacy-policy link is shown because Apple and Google both require one when
 * requesting health permissions (see HEALTH_PRIVACY_POLICY_URL).
 */
import { useEffect } from 'react';
import { I18nManager, Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Icon, type IconName } from '@features/shared';
import { useHealthStore } from '../store';
import { HEALTH_PRIVACY_POLICY_URL } from '../types';

const HEALTH_CONNECT_PLAY_URL = 'market://details?id=com.google.android.apps.healthdata';
const HEALTH_CONNECT_PLAY_WEB =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

const METRIC_ICONS: { icon: IconName; key: string; fallback: string }[] = [
  { icon: 'bar-chart', key: 'health.metrics.steps', fallback: 'Steps & distance' },
  { icon: 'dumbbell', key: 'health.metrics.workouts', fallback: 'Workouts & active minutes' },
  { icon: 'clock', key: 'health.metrics.sleep', fallback: 'Sleep' },
  { icon: 'heart', key: 'health.metrics.heart', fallback: 'Resting heart rate & HRV' },
];

export function HealthPermissionFlow({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const rtl = I18nManager.isRTL;
  const availability = useHealthStore((s) => s.availability);
  const permission = useHealthStore((s) => s.permission);
  const syncing = useHealthStore((s) => s.syncing);
  const refreshStatus = useHealthStore((s) => s.refreshStatus);
  const requestPermissions = useHealthStore((s) => s.requestPermissions);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const openInstall = () => {
    Linking.openURL(HEALTH_CONNECT_PLAY_URL).catch(() =>
      Linking.openURL(HEALTH_CONNECT_PLAY_WEB).catch(() => undefined),
    );
  };

  const align = rtl ? 'right' : 'left';

  // --- Android: Health Connect missing → guided install --------------------
  if (availability === 'needs_install') {
    return (
      <View className="flex-1 px-5 pt-8">
        <Hero icon="alert" />
        <Text className="text-ink text-2xl font-extrabold mt-6" style={{ textAlign: align }}>
          {t('health.installTitle', 'Install Health Connect')}
        </Text>
        <Text className="text-ink-subtle text-base mt-2 leading-6" style={{ textAlign: align }}>
          {t(
            'health.installBody',
            'Sahha reads your activity and recovery through Health Connect. Install it from the Play Store, then come back.',
          )}
        </Text>
        <View className="mt-8" style={{ gap: 10 }}>
          <Button
            label={t('health.install', 'Install Health Connect')}
            icon="arrow-right"
            onPress={openInstall}
          />
          <Button
            label={t('health.recheck', "I've installed it")}
            variant="secondary"
            onPress={() => void refreshStatus()}
          />
        </View>
        <PrivacyLink />
      </View>
    );
  }

  // --- No health hub at all (e.g. simulator) -------------------------------
  if (availability === 'unavailable') {
    return (
      <View className="flex-1 px-5 pt-8">
        <Hero icon="alert" />
        <Text className="text-ink text-2xl font-extrabold mt-6" style={{ textAlign: align }}>
          {t('health.unavailableTitle', 'Health data unavailable')}
        </Text>
        <Text className="text-ink-subtle text-base mt-2 leading-6" style={{ textAlign: align }}>
          {t(
            'health.unavailableBody',
            'This device has no health source Sahha can read. You can still log workouts and meals manually.',
          )}
        </Text>
        {onDone ? (
          <View className="mt-8">
            <Button label={t('common.continue', 'Continue')} variant="secondary" onPress={onDone} />
          </View>
        ) : null}
      </View>
    );
  }

  // --- Granted -------------------------------------------------------------
  if (permission === 'granted' || permission === 'partial') {
    return (
      <View className="flex-1 px-5 pt-8">
        <Hero icon="check-circle" tone="#2EE6A6" />
        <Text className="text-ink text-2xl font-extrabold mt-6" style={{ textAlign: align }}>
          {permission === 'partial'
            ? t('health.partialTitle', 'Partly connected')
            : t('health.grantedTitle', "You're connected")}
        </Text>
        <Text className="text-ink-subtle text-base mt-2 leading-6" style={{ textAlign: align }}>
          {permission === 'partial'
            ? t(
                'health.partialBody',
                'Some metrics are connected. You can grant the rest anytime in your health settings.',
              )
            : t(
                'health.grantedBody',
                'Your activity and recovery will keep syncing in the background.',
              )}
        </Text>
        {onDone ? (
          <View className="mt-8">
            <Button
              label={syncing ? t('health.syncing', 'Syncing…') : t('common.done', 'Done')}
              onPress={onDone}
            />
          </View>
        ) : null}
        <PrivacyLink />
      </View>
    );
  }

  // --- Denied --------------------------------------------------------------
  if (permission === 'denied') {
    return (
      <View className="flex-1 px-5 pt-8">
        <Hero icon="alert" />
        <Text className="text-ink text-2xl font-extrabold mt-6" style={{ textAlign: align }}>
          {t('health.deniedTitle', 'Permission needed')}
        </Text>
        <Text className="text-ink-subtle text-base mt-2 leading-6" style={{ textAlign: align }}>
          {t(
            'health.deniedBody',
            'Sahha needs access to your health data to show activity and recovery. You can enable it in your system health settings.',
          )}
        </Text>
        <View className="mt-8" style={{ gap: 10 }}>
          <Button
            label={t('common.retry', 'Try again')}
            onPress={() => void requestPermissions()}
          />
          {onDone ? (
            <Button label={t('common.skip', 'Skip for now')} variant="secondary" onPress={onDone} />
          ) : null}
        </View>
        <PrivacyLink />
      </View>
    );
  }

  // --- Explainer (not_determined / unknown) --------------------------------
  return (
    <View className="flex-1 px-5 pt-8">
      <Hero icon="heart" />
      <Text className="text-ink text-2xl font-extrabold mt-6" style={{ textAlign: align }}>
        {t('health.title', 'Connect your health data')}
      </Text>
      <Text className="text-ink-subtle text-base mt-2 leading-6" style={{ textAlign: align }}>
        {t(
          'health.body',
          'Sahha reads your activity and recovery to personalize training. Data stays private and is read-only.',
        )}
      </Text>

      <View className="mt-6" style={{ gap: 12 }}>
        {METRIC_ICONS.map((m) => (
          <View
            key={m.key}
            className="flex-row items-center"
            style={{ gap: 12, flexDirection: rtl ? 'row-reverse' : 'row' }}
          >
            <View
              className="rounded-full items-center justify-center"
              style={{ width: 36, height: 36, backgroundColor: 'rgba(249,115,22,0.14)' }}
            >
              <Icon name={m.icon} size={18} color="#F97316" />
            </View>
            <Text className="text-ink text-base flex-1" style={{ textAlign: align }}>
              {t(m.key, m.fallback)}
            </Text>
          </View>
        ))}
      </View>

      <View className="mt-8" style={{ gap: 10 }}>
        <Button
          label={
            syncing ? t('health.syncing', 'Syncing…') : t('health.grant', 'Connect health data')
          }
          icon="heart"
          onPress={() => void requestPermissions()}
        />
        {onDone ? (
          <Button label={t('common.skip', 'Skip for now')} variant="secondary" onPress={onDone} />
        ) : null}
      </View>
      <PrivacyLink />
    </View>
  );
}

function Hero({ icon, tone = '#F97316' }: { icon: IconName; tone?: string }) {
  return (
    <View
      className="rounded-3xl items-center justify-center self-center"
      style={{ width: 84, height: 84, backgroundColor: `${tone}22` }}
    >
      <Icon name={icon} size={40} color={tone} />
    </View>
  );
}

function PrivacyLink() {
  const { t } = useTranslation();
  return (
    <Pressable
      className="mt-6 self-center"
      onPress={() => Linking.openURL(HEALTH_PRIVACY_POLICY_URL).catch(() => undefined)}
    >
      <Text className="text-ink-muted text-xs underline">
        {t('health.privacy', 'How we use your health data')}
      </Text>
    </Pressable>
  );
}
