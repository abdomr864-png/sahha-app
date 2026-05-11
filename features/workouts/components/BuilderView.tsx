import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon } from '@features/shared';
import { useActiveSession, useStartWorkout } from '../hooks/useWorkoutSession';

export function BuilderView() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useActiveSession();
  const start = useStartWorkout();
  const [starting, setStarting] = useState(false);

  if (!session) {
    return (
      <View className="px-5 flex-1 justify-center pb-32">
        <View className="items-center mb-8">
          <View
            className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/30 items-center justify-center mb-5"
            style={{
              shadowColor: '#FF4D2E',
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}
          >
            <Icon name="dumbbell" size={36} color="#FF4D2E" strokeWidth={2} />
          </View>
          <Text className="text-ink text-2xl font-extrabold tracking-tight text-center">
            {t('train.builder.title')}
          </Text>
          <Text className="text-ink-subtle text-sm mt-2 text-center max-w-[280px]">
            {t('home.startEmpty')}
          </Text>
        </View>
        <Button
          label={t('train.builder.start')}
          icon="play"
          iconRight="arrow-right"
          loading={starting}
          onPress={async () => {
            setStarting(true);
            try {
              await start();
              router.push('/session');
            } finally {
              setStarting(false);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View className="px-5 flex-1">
      <Card>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <View className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/40 mr-2">
              <View className="flex-row items-center">
                <View className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5" />
                <Text className="text-accent text-[10px] font-bold tracking-widest">
                  {t('train.session.live')}
                </Text>
              </View>
            </View>
            <Text className="text-ink-muted text-[10px] font-bold tracking-widest">
              {t('train.session.inProgress')}
            </Text>
          </View>
          <View className="w-11 h-11 rounded-full bg-accent items-center justify-center">
            <Icon name="play" size={16} color="#FFFFFF" />
          </View>
        </View>
        <Text className="text-ink text-xl font-extrabold tracking-tight mb-1">
          {t('train.session.title')}
        </Text>
        <Text className="text-ink-subtle text-sm mb-4">
          {session.exercises.length === 0
            ? t('train.session.addToBegin')
            : t('train.session.queued', {
                count: session.exercises.length,
                plural: session.exercises.length === 1 ? '' : 's',
              })}
        </Text>
        <View style={{ gap: 10 }}>
          <Button
            label={t('train.session.resume')}
            icon="play"
            iconRight="arrow-right"
            onPress={() => router.push('/session')}
          />
        </View>
      </Card>
    </View>
  );
}
