import { useMemo, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen } from '@features/shared';
import {
  useHealthSync,
  useUpdateSyncSettings,
  registerHealthBackgroundSync,
} from '@features/wearables';
import type { HealthDataType } from '@lib/health-data';

interface Category {
  key: 'activity' | 'heart' | 'sleep' | 'body' | 'workouts';
  types: HealthDataType[];
}

const CATEGORIES: Category[] = [
  { key: 'activity', types: ['steps', 'active_calories', 'total_calories'] },
  { key: 'heart', types: ['heart_rate', 'resting_heart_rate', 'hrv'] },
  { key: 'sleep', types: ['sleep'] },
  { key: 'body', types: ['weight', 'body_fat'] },
  { key: 'workouts', types: ['workouts'] },
];

export default function HealthPermissions() {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestPermissions, sync, status } = useHealthSync();
  const updateSettings = useUpdateSyncSettings();
  const [enabled, setEnabled] = useState<Record<Category['key'], boolean>>({
    activity: true,
    heart: true,
    sleep: true,
    body: true,
    workouts: true,
  });

  const selectedTypes = useMemo<HealthDataType[]>(
    () => CATEGORIES.flatMap((c) => (enabled[c.key] ? c.types : [])),
    [enabled],
  );

  const onConnect = async () => {
    const result = await requestPermissions(selectedTypes);
    if (result.status === 'granted') {
      await updateSettings.mutateAsync({ enabled_types: selectedTypes });
      void registerHealthBackgroundSync();
      void sync('backfill');
    }
    router.replace('/(tabs)');
  };

  const onSkip = () => router.replace('/(tabs)');

  return (
    <Screen scroll glow>
      <View className="mt-4 mb-6">
        <Text className="text-ink text-3xl font-extrabold tracking-tight">
          {t('wearables.permissions.title')}
        </Text>
        <Text className="text-ink-subtle text-base mt-2">
          {t('wearables.permissions.subtitle')}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {CATEGORIES.map((c) => (
          <View
            key={c.key}
            className="flex-row items-center bg-bg-raised border border-border rounded-2xl px-4 py-4"
          >
            <View className="flex-1 pr-3">
              <Text className="text-ink font-semibold text-base">
                {t(`wearables.permissions.categories.${c.key}.label`)}
              </Text>
              <Text className="text-ink-subtle text-sm mt-0.5">
                {t(`wearables.permissions.categories.${c.key}.desc`)}
              </Text>
            </View>
            <Switch
              value={enabled[c.key]}
              onValueChange={(v) => setEnabled((s) => ({ ...s, [c.key]: v }))}
            />
          </View>
        ))}
      </View>

      <View className="mt-8" style={{ gap: 12 }}>
        <Button
          label={t('wearables.permissions.connect')}
          onPress={onConnect}
          loading={status === 'syncing' || updateSettings.isPending}
        />
        <Pressable onPress={onSkip} hitSlop={8} className="self-center py-2">
          <Text className="text-ink-subtle text-sm">{t('wearables.permissions.skip')}</Text>
        </Pressable>
      </View>

      {status === 'unavailable' ? (
        <Text className="text-ink-muted text-xs text-center mt-4">
          {t('wearables.permissions.unavailable')}
        </Text>
      ) : null}
    </Screen>
  );
}
