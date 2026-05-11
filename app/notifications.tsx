import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Button, Card, Header, Icon, Screen, useSafeBack, type IconName } from '@features/shared';
import { storage } from '@lib/offline';

const PREFS_KEY = 'sahha.notifPrefs.v1';
const ANDROID_CHANNEL_ID = 'sahha-default';

// Expo Go (SDK 53+) ships without expo-notifications native module, so
// permission/scheduling APIs throw at runtime. Detect this and render a
// graceful notice instead of crashing the screen.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Foreground delivery: without this, scheduled notifications fire silently
// while the app is open and the user thinks nothing happened.
if (!IS_EXPO_GO) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Module not linked — ignore.
  }
}

interface NotifPrefs {
  rest_timer: boolean;
  workout_reminder: boolean;
  meal_reminder: boolean;
  weekly_summary: boolean;
  wearable_sync: boolean;
}

const DEFAULTS: NotifPrefs = {
  rest_timer: true,
  workout_reminder: true,
  meal_reminder: false,
  weekly_summary: true,
  wearable_sync: true,
};

// Stable identifiers so re-enabling replaces the existing schedule instead
// of stacking duplicates.
const SCHEDULE_IDS: Partial<Record<keyof NotifPrefs, string>> = {
  workout_reminder: 'sahha.workout_reminder',
  meal_reminder: 'sahha.meal_reminder',
  weekly_summary: 'sahha.weekly_summary',
};

const GROUPS: { title: string; icon: IconName; rows: (keyof NotifPrefs)[] }[] = [
  { title: 'training', icon: 'dumbbell', rows: ['rest_timer', 'workout_reminder'] },
  { title: 'nutrition', icon: 'apple', rows: ['meal_reminder', 'weekly_summary'] },
  { title: 'wellness', icon: 'heart', rows: ['wearable_sync'] },
];

function loadPrefs(): NotifPrefs {
  return { ...DEFAULTS, ...(storage.getJSON<NotifPrefs>(PREFS_KEY) ?? {}) };
}

function savePrefs(p: NotifPrefs): void {
  storage.setJSON(PREFS_KEY, p);
}

type PermStatus = 'undetermined' | 'granted' | 'denied' | 'unavailable';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Sahha',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#FF4D2E',
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  } catch {
    // Channel API unavailable — ignore.
  }
}

function triggerFor(key: keyof NotifPrefs): Notifications.NotificationTriggerInput | null {
  if (key === 'workout_reminder') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 0,
      channelId: ANDROID_CHANNEL_ID,
    };
  }
  if (key === 'meal_reminder') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 12,
      minute: 0,
      channelId: ANDROID_CHANNEL_ID,
    };
  }
  if (key === 'weekly_summary') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: 19,
      minute: 0,
      channelId: ANDROID_CHANNEL_ID,
    };
  }
  return null;
}

async function scheduleForKey(key: keyof NotifPrefs, title: string, body: string): Promise<void> {
  if (IS_EXPO_GO) return;
  const id = SCHEDULE_IDS[key];
  const trigger = triggerFor(key);
  if (!id || !trigger) return; // rest_timer / wearable_sync are event-driven
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // No existing schedule — fine.
  }
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: 'default' },
      trigger,
    });
  } catch {
    // Native module missing or scheduling failed — swallow so the UI
    // doesn't crash; the toggle stays on so the user can retry.
  }
}

async function cancelForKey(key: keyof NotifPrefs): Promise<void> {
  if (IS_EXPO_GO) return;
  const id = SCHEDULE_IDS[key];
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing to cancel.
  }
}

async function fireConfirmation(title: string, body: string): Promise<void> {
  if (IS_EXPO_GO) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        repeats: false,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  } catch {
    // ignore
  }
}

export default function NotificationsSettings() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs());
  const [permission, setPermission] = useState<PermStatus>(
    IS_EXPO_GO ? 'unavailable' : 'undetermined',
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (IS_EXPO_GO) return;
    Notifications.getPermissionsAsync()
      .then((res) => {
        const next: PermStatus =
          res.status === Notifications.PermissionStatus.GRANTED
            ? 'granted'
            : res.status === Notifications.PermissionStatus.DENIED
              ? 'denied'
              : 'undetermined';
        setPermission(next);
        if (next === 'granted') void ensureAndroidChannel();
      })
      .catch(() => setPermission('unavailable'));
  }, []);

  // Once we know permission is granted, re-sync the schedule to match the
  // saved prefs. This recovers from a fresh install / cleared system state
  // where the prefs say "on" but no schedule exists yet.
  useEffect(() => {
    if (permission !== 'granted') return;
    (Object.keys(SCHEDULE_IDS) as (keyof NotifPrefs)[]).forEach((key) => {
      if (prefs[key]) {
        void scheduleForKey(
          key,
          t(`profile.notifications.${key}`),
          t(`profile.notifications.${key}_desc`),
        );
      } else {
        void cancelForKey(key);
      }
    });
    // Intentionally run only when permission flips to granted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission]);

  const requestPermission = useCallback(async (): Promise<PermStatus> => {
    if (IS_EXPO_GO) return 'unavailable';
    try {
      const res = await Notifications.requestPermissionsAsync();
      const next: PermStatus =
        res.status === Notifications.PermissionStatus.GRANTED
          ? 'granted'
          : res.status === Notifications.PermissionStatus.DENIED
            ? 'denied'
            : 'undetermined';
      setPermission(next);
      if (next === 'granted') await ensureAndroidChannel();
      return next;
    } catch {
      setPermission('unavailable');
      return 'unavailable';
    }
  }, []);

  const openSystemSettings = () => {
    void Linking.openSettings();
  };

  const toggle = useCallback(
    async (key: keyof NotifPrefs, on: boolean) => {
      if (busy) return;
      setBusy(true);
      try {
        if (on) {
          let status = permission;
          if (status !== 'granted' && status !== 'unavailable') {
            status = await requestPermission();
          }
          if (status === 'unavailable') {
            // Expo Go / no native module — let user know.
            Alert.alert(
              t('profile.notifications.permission'),
              t('profile.notifications.expoGoNotice', {
                defaultValue:
                  "Push notifications were removed from Expo Go in SDK 53. They'll work once you run a development build (eas build --profile development) or a release build.",
              }),
            );
            return;
          }
          if (status === 'denied') {
            Alert.alert(
              t('profile.notifications.permission'),
              t('profile.notifications.permissionDenied'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.notifications.openSettings'),
                  onPress: openSystemSettings,
                },
              ],
            );
            return;
          }
          if (status !== 'granted') return;

          const hadAnyOn = Object.values(prefs).some(Boolean);
          const next = { ...prefs, [key]: true };
          setPrefs(next);
          savePrefs(next);
          await scheduleForKey(
            key,
            t(`profile.notifications.${key}`),
            t(`profile.notifications.${key}_desc`),
          );
          if (!hadAnyOn) {
            // First time the user enables anything — drop a confirmation
            // notification so they can see the system is wired up.
            await fireConfirmation(
              t('profile.notifications.title'),
              t(`profile.notifications.${key}_desc`),
            );
          }
        } else {
          const next = { ...prefs, [key]: false };
          setPrefs(next);
          savePrefs(next);
          await cancelForKey(key);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, permission, prefs, requestPermission, t],
  );

  const granted = permission === 'granted';
  const denied = permission === 'denied';
  const unavailable = permission === 'unavailable';

  const statusLabel = unavailable
    ? t('profile.notifications.permissionUnavailable', {
        defaultValue: 'Requires a development build',
      })
    : granted
      ? t('profile.notifications.permissionGranted')
      : denied
        ? t('profile.notifications.permissionDenied')
        : t('profile.notifications.permissionUndetermined');

  const statusColor = unavailable
    ? 'text-warning'
    : granted
      ? 'text-success'
      : denied
        ? 'text-danger'
        : 'text-warning';

  return (
    <Screen scroll glow padded={false}>
      <View className="px-5 pt-2">
        <Header
          title={t('profile.notifications.title')}
          subtitle={t('profile.notifications.subtitle')}
          onBack={safeBack}
          showBack
        />

        {/* Permission status */}
        <Card className="mb-5">
          <View className="flex-row items-center mb-3">
            <View
              className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                granted ? 'bg-success/15' : denied ? 'bg-danger/15' : 'bg-warning/15'
              }`}
            >
              <Icon
                name="bell"
                size={18}
                color={granted ? '#34D399' : denied ? '#F87171' : '#FBBF24'}
              />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-base font-semibold">
                {t('profile.notifications.permission')}
              </Text>
              <Text className={`${statusColor} text-xs font-semibold mt-0.5`}>{statusLabel}</Text>
            </View>
          </View>
          {unavailable ? (
            <Text className="text-ink-subtle text-xs leading-5">
              {t('profile.notifications.expoGoNotice', {
                defaultValue:
                  "Push notifications were removed from Expo Go in SDK 53. They'll work once you run a development build (eas build --profile development) or a release build.",
              })}
            </Text>
          ) : denied ? (
            <Button
              label={t('profile.notifications.openSettings')}
              variant="secondary"
              size="sm"
              onPress={openSystemSettings}
            />
          ) : !granted ? (
            <Button
              label={t('profile.notifications.request')}
              icon="bell"
              size="sm"
              onPress={() => void requestPermission()}
            />
          ) : null}
        </Card>

        {/* Groups */}
        {GROUPS.map((group) => (
          <View key={group.title} className="mb-5">
            <View className="flex-row items-center mb-2 px-1">
              <Icon name={group.icon} size={12} color="#A1A1AA" />
              <Text className="text-ink-muted text-[10px] font-bold uppercase tracking-widest ml-1.5">
                {t(`profile.notifications.groups.${group.title}`)}
              </Text>
            </View>
            <Card padded={false}>
              {group.rows.map((row, idx) => (
                <View
                  key={row}
                  className={`flex-row items-center px-4 py-3.5 ${
                    idx < group.rows.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-ink text-sm font-semibold">
                      {t(`profile.notifications.${row}`)}
                    </Text>
                    <Text className="text-ink-subtle text-xs mt-0.5">
                      {t(`profile.notifications.${row}_desc`)}
                    </Text>
                  </View>
                  <Switch
                    value={prefs[row]}
                    disabled={unavailable || busy}
                    onValueChange={(on) => void toggle(row, on)}
                    trackColor={{ true: '#FF4D2E', false: '#3F3F46' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Pressable onPress={safeBack} className="self-center mt-2 mb-12">
          <Text className="text-ink-muted text-xs font-semibold">{t('common.done')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
