import { useEffect, useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Button, Card, Header, Icon, Screen, useSafeBack, type IconName } from '@features/shared';
import { storage } from '@lib/offline';

const PREFS_KEY = 'sahha.notifPrefs.v1';

// Expo Go (SDK 53+) ships without expo-notifications native module, so
// permission/scheduling APIs throw at runtime. Detect this and render a
// graceful notice instead of crashing the screen.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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

export default function NotificationsSettings() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadPrefs());
  const [permission, setPermission] = useState<PermStatus>(
    IS_EXPO_GO ? 'unavailable' : 'undetermined',
  );

  useEffect(() => {
    if (IS_EXPO_GO) return;
    Notifications.getPermissionsAsync()
      .then((res) => {
        if (res.status === Notifications.PermissionStatus.GRANTED) setPermission('granted');
        else if (res.status === Notifications.PermissionStatus.DENIED) setPermission('denied');
        else setPermission('undetermined');
      })
      .catch(() => setPermission('unavailable'));
  }, []);

  const toggle = (key: keyof NotifPrefs, on: boolean) => {
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    savePrefs(next);
  };

  const requestPermission = async () => {
    if (IS_EXPO_GO) return;
    try {
      const res = await Notifications.requestPermissionsAsync();
      setPermission(
        res.status === Notifications.PermissionStatus.GRANTED
          ? 'granted'
          : res.status === Notifications.PermissionStatus.DENIED
            ? 'denied'
            : 'undetermined',
      );
    } catch {
      setPermission('unavailable');
    }
  };

  const openSystemSettings = () => {
    void Linking.openSettings();
  };

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
              onPress={requestPermission}
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
                    value={prefs[row] && granted}
                    disabled={!granted}
                    onValueChange={(on) => toggle(row, on)}
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
