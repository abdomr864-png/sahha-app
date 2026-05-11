import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Header, Icon, Screen, useSafeBack } from '@features/shared';
import {
  useHealthSync,
  useHealthSyncSettings,
  useUpdateSyncSettings,
  unregisterHealthBackgroundSync,
} from '@features/wearables';
import { useSession } from '@features/auth';
import { supabase } from '@lib/supabase/client';
import { ALL_HEALTH_TYPES, type HealthDataType } from '@lib/health-data';

const TYPE_LABELS: Record<HealthDataType, string> = {
  steps: 'wearables.types.steps',
  heart_rate: 'wearables.types.heart_rate',
  resting_heart_rate: 'wearables.types.resting_heart_rate',
  hrv: 'wearables.types.hrv',
  active_calories: 'wearables.types.active_calories',
  total_calories: 'wearables.types.total_calories',
  sleep: 'wearables.types.sleep',
  workouts: 'wearables.types.workouts',
  weight: 'wearables.types.weight',
  body_fat: 'wearables.types.body_fat',
};

export default function WearablesSettings() {
  const { t } = useTranslation();
  const safeBack = useSafeBack('/(tabs)/profile');
  const { session } = useSession();
  const userId = session?.user.id;
  const settingsQ = useHealthSyncSettings();
  const update = useUpdateSyncSettings();
  const sync = useHealthSync();
  const qc = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);

  const settings = settingsQ.data;
  const enabledTypes = (settings?.enabled_types ?? ALL_HEALTH_TYPES) as HealthDataType[];

  const toggleType = async (type: HealthDataType, on: boolean) => {
    const next = on
      ? Array.from(new Set([...enabledTypes, type]))
      : enabledTypes.filter((t) => t !== type);
    await update.mutateAsync({ enabled_types: next });
  };

  const toggleAiOptIn = async (on: boolean) => {
    await update.mutateAsync({ ai_biometrics_optin: on });
  };

  const onSyncNow = () => {
    void sync.sync('foreground');
  };

  const onDisconnect = () => {
    Alert.alert(t('wearables.disconnect.title'), t('wearables.disconnect.warning'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('wearables.disconnect.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          setDisconnecting(true);
          try {
            await unregisterHealthBackgroundSync();
            await supabase.from('wearable_metrics').delete().eq('user_id', userId);
            await supabase.from('sleep_sessions_synced').delete().eq('user_id', userId);
            await supabase.from('workouts_synced').delete().eq('user_id', userId);
            await update.mutateAsync({
              enabled_types: [],
              permission_revoked: true,
            });
            qc.invalidateQueries();
          } finally {
            setDisconnecting(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll glow padded={false}>
      <Header title={t('wearables.settings.title')} onBack={safeBack} />
      <View className="px-5 pt-2" style={{ gap: 14 }}>
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-ink font-semibold text-base">
                {t('wearables.settings.statusTitle')}
              </Text>
              <Text className="text-ink-subtle text-sm mt-0.5">
                {settings?.last_synced_at
                  ? t('wearables.settings.lastSynced', {
                      when: new Date(settings.last_synced_at).toLocaleString(),
                    })
                  : t('wearables.settings.neverSynced')}
              </Text>
              {settings?.permission_revoked ? (
                <Text className="text-danger text-sm mt-1">
                  {t('wearables.settings.permissionRevoked')}
                </Text>
              ) : null}
            </View>
            <Button
              label={t('wearables.settings.syncNow')}
              onPress={onSyncNow}
              loading={sync.status === 'syncing'}
              variant="secondary"
            />
          </View>
        </Card>

        <Card>
          <Text className="text-ink font-semibold text-base mb-2">
            {t('wearables.settings.dataTypes')}
          </Text>
          <View style={{ gap: 8 }}>
            {ALL_HEALTH_TYPES.map((type) => (
              <View key={type} className="flex-row items-center justify-between py-2">
                <Text className="text-ink text-sm flex-1 pr-3">{t(TYPE_LABELS[type])}</Text>
                <Switch
                  value={enabledTypes.includes(type)}
                  onValueChange={(on) => toggleType(type, on)}
                />
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-ink font-semibold text-base">
                {t('wearables.settings.aiOptIn')}
              </Text>
              <Text className="text-ink-subtle text-sm mt-0.5">
                {t('wearables.settings.aiOptInDesc')}
              </Text>
            </View>
            <Switch value={!!settings?.ai_biometrics_optin} onValueChange={toggleAiOptIn} />
          </View>
        </Card>

        <Pressable onPress={onDisconnect} className="mt-2 mb-12 self-start">
          <View className="flex-row items-center px-4 py-3 border border-danger/40 rounded-2xl">
            <Icon name="trash" color="#F87171" />
            <Text className="text-danger ml-2 font-semibold">
              {disconnecting ? t('common.loading') : t('wearables.settings.disconnect')}
            </Text>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}
