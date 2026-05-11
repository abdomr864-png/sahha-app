import { Platform, Text, View } from 'react-native';
import { Card, Icon, Screen, StatCard } from '@features/shared';
import { useTranslation } from 'react-i18next';

const monoFamily = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const SAMPLE_BARS = [40, 60, 35, 80, 55, 90, 70, 65, 100, 75, 85, 95];

export default function Progress() {
  const { t } = useTranslation();
  return (
    <Screen scroll glow padded={false}>
      <View className="px-5 pt-2">
        <View className="mb-6">
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-1">
            {t('progress.kicker')}
          </Text>
          <Text className="text-ink text-3xl font-extrabold tracking-tight">
            {t('tabs.progress')}
          </Text>
        </View>

        <View className="flex-row mb-4" style={{ gap: 10 }}>
          <StatCard
            label={t('progress.totalVolume')}
            value="0"
            unit={t('common.kg')}
            icon="trending"
          />
          <StatCard label={t('progress.bestLift')} value="—" icon="medal" accent />
        </View>

        {/* Volume chart placeholder */}
        <Card className="mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                {t('progress.last12Weeks')}
              </Text>
              <Text className="text-ink text-lg font-extrabold mt-0.5 tracking-tight">
                {t('progress.weeklyVolume')}
              </Text>
            </View>
            <View className="px-2.5 py-1 rounded-full bg-success/10 border border-success/30">
              <Text className="text-success text-[10px] font-bold tracking-widest">+0%</Text>
            </View>
          </View>
          <View className="flex-row items-end" style={{ height: 120, gap: 6 }}>
            {SAMPLE_BARS.map((h, i) => (
              <View key={i} className="flex-1 items-center justify-end">
                <View
                  className={`w-full rounded-t-md ${
                    i === SAMPLE_BARS.length - 1 ? 'bg-accent' : 'bg-accent/30'
                  }`}
                  style={{ height: `${h}%` }}
                />
              </View>
            ))}
          </View>
          <Text className="text-ink-muted text-[10px] font-bold tracking-widest mt-3 text-center">
            {t('progress.sampleHint')}
          </Text>
        </Card>

        {/* Records */}
        <Card className="mb-4">
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 items-center justify-center mr-3">
              <Icon name="medal" size={18} color="#FF4D2E" />
            </View>
            <View className="flex-1">
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                {t('progress.personalRecords')}
              </Text>
              <Text className="text-ink text-base font-bold mt-0.5">{t('progress.noPRs')}</Text>
            </View>
          </View>
          <Text className="text-ink-subtle text-sm">{t('progress.noPRBody')}</Text>
        </Card>

        {/* Body */}
        <Card>
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-xl bg-bg-subtle border border-border items-center justify-center mr-3">
              <Icon name="ruler" size={18} color="#FF4D2E" />
            </View>
            <View className="flex-1">
              <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
                {t('progress.body')}
              </Text>
              <Text className="text-ink text-base font-bold mt-0.5">
                {t('progress.measurements')}
              </Text>
            </View>
          </View>
          <View className="flex-row" style={{ gap: 10 }}>
            <BodyTile label={t('profile.stats.weight')} value="—" unit={t('common.kg')} />
            <BodyTile label={t('profile.stats.height')} value="—" unit="cm" />
          </View>
        </Card>

        <View style={{ height: 100 }} />
      </View>
    </Screen>
  );
}

function BodyTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View className="flex-1 bg-bg-subtle border border-border rounded-2xl px-3 py-3">
      <Text className="text-ink-muted text-[10px] font-bold tracking-widest">{label}</Text>
      <View className="flex-row items-baseline mt-1">
        <Text
          className="text-ink text-2xl font-extrabold tracking-tight"
          style={{ fontFamily: monoFamily, fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
        <Text className="text-ink-muted text-xs ml-1">{unit}</Text>
      </View>
    </View>
  );
}
