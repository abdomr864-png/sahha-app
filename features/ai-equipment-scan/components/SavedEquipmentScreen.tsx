import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Header, Icon, Screen, Spinner } from '@features/shared';
import { useSession } from '@features/auth';
import { useSavedEquipment } from '../hooks/useSavedEquipment';
import { useScanResultStore } from '../store';

export function SavedEquipmentScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const setResult = useScanResultStore((s) => s.setResult);
  const query = useSavedEquipment(session?.user?.id);
  const lang = (i18n.language as 'fr' | 'ar' | 'en') ?? 'en';

  return (
    <Screen scroll>
      <Header title={t('scan.savedTitle', 'Saved equipment')} showBack />

      {query.isLoading ? <Spinner /> : null}

      {!query.isLoading && (query.data?.length ?? 0) === 0 ? (
        <Card>
          <Text className="text-ink text-xl font-bold mb-2">
            {t('scan.savedEmptyTitle', 'No saved equipment')}
          </Text>
          <Text className="text-ink-subtle mb-4">
            {t(
              'scan.savedEmptyBody',
              'Scan a piece of gym equipment and tap "Save" to keep it here for quick access.',
            )}
          </Text>
          <Button
            label={t('scan.cta', 'Scan equipment')}
            icon="camera"
            onPress={() => router.push('/scan')}
          />
        </Card>
      ) : null}

      {query.data?.map((row) => {
        const eq = row.equipment_data?.equipment;
        const name = !eq
          ? row.equipment_name
          : lang === 'fr'
            ? eq.name_fr
            : lang === 'ar'
              ? eq.name_ar
              : eq.name_en;
        return (
          <Pressable
            key={row.id}
            className="mb-2.5"
            onPress={() => {
              setResult(row.equipment_data, row.scanned_image_url ?? '');
              router.push('/scan/results');
            }}
          >
            <Card>
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/30 items-center justify-center mr-3">
                  <Icon name="dumbbell" size={20} color="#FF4D2E" />
                </View>
                <View className="flex-1">
                  <Text className="text-ink font-bold" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text className="text-ink-subtle text-xs">
                    {new Date(row.saved_at).toLocaleDateString()}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color="#A1A1AA" />
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
