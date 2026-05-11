import { Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button } from '@features/shared';
import { BrandMark } from '@features/auth';

function FeatureIcon({ d }: { d: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke="#FF4D2E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Feature({ icon, title }: { icon: string; title: string }) {
  return (
    <View className="flex-row items-center mb-3">
      <View className="w-9 h-9 rounded-xl bg-bg-raised border border-border items-center justify-center mr-3">
        <FeatureIcon d={icon} />
      </View>
      <Text className="text-ink text-base font-medium">{title}</Text>
    </View>
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right', 'bottom']}>
      {/* Glow background */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: 320,
          backgroundColor: '#FF4D2E',
          opacity: 0.18,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -140,
          left: -100,
          width: 320,
          height: 320,
          borderRadius: 320,
          backgroundColor: '#7C3AED',
          opacity: 0.12,
        }}
      />

      <View className="flex-1 px-6 pt-6">
        <View className="flex-row items-center">
          <BrandMark size={48} />
          <Text className="text-ink text-xl font-bold ml-3 tracking-tight">SAHHA</Text>
        </View>

        <View className="flex-1 justify-center">
          <View className="self-start px-3 py-1.5 rounded-full border border-border bg-bg-raised mb-5">
            <Text className="text-accent text-xs font-semibold tracking-wider uppercase">
              Built for lifters
            </Text>
          </View>
          <Text className="text-ink text-4xl font-extrabold leading-tight mb-3 tracking-tight">
            {t('auth.welcome.title')}
          </Text>
          <Text className="text-ink-subtle text-base leading-6 mb-10">
            {t('auth.welcome.subtitle')}
          </Text>

          <Feature icon="M4 6h16M4 12h10M4 18h16" title="Plan every session" />
          <Feature icon="M3 12l4 4L21 6" title="Log lifts in seconds" />
          <Feature icon="M3 17l6-6 4 4 8-8" title="Track real progress" />
        </View>

        <View className="pb-2">
          <Link href="/(auth)/sign-up" asChild>
            <Button label={t('auth.welcome.signUp')} />
          </Link>
          <View className="h-3" />
          <Link href="/(auth)/sign-in" asChild>
            <Button label={t('auth.welcome.signIn')} variant="secondary" />
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
