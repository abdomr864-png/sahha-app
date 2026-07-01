import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Glow, Icon, OnboardingFooter, type IconName } from '@features/shared';
import { BrandMark, useSession, useSignOut } from '@features/auth';

interface Highlight {
  icon: IconName;
  title: string;
  desc: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: 'sparkles',
    title: 'AI-personalized routines',
    desc: 'Tuned to your goal, gear and schedule.',
  },
  {
    icon: 'flame',
    title: 'Smart calories & macros',
    desc: 'Daily targets dialed to your body.',
  },
  {
    icon: 'trending',
    title: 'Track real progress',
    desc: 'See the numbers that actually matter.',
  },
];

function PulseRing({
  size,
  initialPhase = 0,
  color = '#FF4D2E',
}: {
  size: number;
  initialPhase?: number; // 0..1 — where in the animation cycle to start
  color?: string;
}) {
  const v = useSharedValue(initialPhase);
  useEffect(() => {
    v.value = withRepeat(
      withTiming(1 + initialPhase, { duration: 2400, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    );
  }, [v, initialPhase]);
  const style = useAnimatedStyle(() => {
    const phase = v.value % 1;
    return {
      transform: [{ scale: 1 + phase * 0.55 }],
      opacity: 0.5 * (1 - phase),
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export default function OnboardingIntro() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const signOut = useSignOut();

  // "Already have an account?" — for someone whose answers are saved on
  // another device/session and just wants to sign in. If they happen to
  // already be signed in (e.g. fresh sign-up that hit this splash), sign
  // them out first so they can pick a different account.
  const onSignIn = () => {
    if (session) {
      signOut.mutate(undefined, {
        onSettled: () => router.replace('/(auth)/sign-in'),
      });
    } else {
      router.push('/(auth)/sign-in');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <Glow color="#FF4D2E" size={380} opacity={0.22} top={-120} right={-100} />
      <Glow color="#A855F7" size={320} opacity={0.14} bottom={-100} left={-100} />

      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="flex-row items-center"
          style={{ paddingTop: 4 }}
        >
          <BrandMark size={36} />
          <Text className="text-ink text-base font-extrabold ml-2.5 tracking-[3px]">SAHHA</Text>
        </Animated.View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View
            entering={FadeIn.duration(700)}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              height: 220,
              marginBottom: 8,
            }}
          >
            <PulseRing size={180} initialPhase={0} />
            <PulseRing size={180} initialPhase={0.5} />
            <View
              style={{
                width: 116,
                height: 116,
                borderRadius: 58,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#FF4D2E',
                shadowOpacity: 0.7,
                shadowRadius: 30,
                shadowOffset: { width: 0, height: 16 },
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#FF8A2B', '#FF4D2E', '#D6321A']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              <BrandMark size={72} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(120)}>
            <View
              className="self-center px-3 py-1.5 rounded-full mb-4"
              style={{
                backgroundColor: 'rgba(255,77,46,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,77,46,0.4)',
              }}
            >
              <Text className="text-accent text-[11px] font-extrabold tracking-[2px]">
                LET&apos;S GET STARTED
              </Text>
            </View>
            <Text className="text-ink text-[40px] font-extrabold tracking-tight leading-[44px] text-center">
              {t('onboarding.intro.title', { defaultValue: "Let's build your plan." })}
            </Text>
            <Text
              className="text-ink-subtle text-base mt-3 text-center"
              style={{ paddingHorizontal: 12, lineHeight: 22 }}
            >
              {t('onboarding.intro.subtitle', {
                defaultValue:
                  '9 quick questions so we can tune training, calories and macros to you.',
              })}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(600).delay(220)}
            style={{ marginTop: 28, gap: 10 }}
          >
            {HIGHLIGHTS.map((h) => (
              <View
                key={h.title}
                className="flex-row items-center bg-bg-raised border border-border rounded-2xl px-4 py-3.5"
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{
                    overflow: 'hidden',
                    shadowColor: '#FF4D2E',
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  <LinearGradient
                    colors={['#FF6E4F', '#FF4D2E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                  <Icon name={h.icon} size={20} color="#FFFFFF" strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-ink text-base font-bold">{h.title}</Text>
                  <Text className="text-ink-subtle text-xs mt-0.5">{h.desc}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          <Animated.View
            entering={FadeInUp.duration(600).delay(340)}
            className="flex-row items-center justify-center"
            style={{ marginTop: 20, gap: 18 }}
          >
            <Stat label="QUESTIONS" value="9" />
            <View style={{ width: 1, height: 18, backgroundColor: '#21212B' }} />
            <Stat label="MINUTES" value="~2" />
            <View style={{ width: 1, height: 18, backgroundColor: '#21212B' }} />
            <Stat label="POWERED BY" value="AI" />
          </Animated.View>
        </View>
      </View>

      <OnboardingFooter
        label={t('onboarding.intro.cta', { defaultValue: 'Get Started' })}
        onPress={() => router.push('/(onboarding)/language')}
      />

      <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 4 }}>
        <SignInButton
          label={t('onboarding.intro.signInCta', {
            defaultValue: 'I already have an account',
          })}
          onPress={onSignIn}
        />
      </View>
    </SafeAreaView>
  );
}

function SignInButton({ label, onPress }: { label: string; onPress: () => void }) {
  const press = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - press.value * 0.025, { damping: 18, stiffness: 240 }) }],
  }));
  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => {
        press.value = 1;
      }}
      onPressOut={() => {
        press.value = 0;
      }}
      style={[
        animStyle,
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 15,
          paddingHorizontal: 20,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: 'rgba(255,77,46,0.35)',
          backgroundColor: 'rgba(255,77,46,0.07)',
        },
      ]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,77,46,0.2)',
          marginRight: 10,
        }}
      >
        <Icon name="user" size={12} color="#FF4D2E" strokeWidth={2.6} />
      </View>
      <Text
        style={{
          color: '#FF8B70',
          fontSize: 15,
          fontWeight: '800',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
      <View style={{ marginLeft: 8 }}>
        <Icon name="arrow-right" size={14} color="#FF8B70" strokeWidth={2.6} />
      </View>
    </AnimatedPressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text className="text-ink text-lg font-extrabold tracking-tight">{value}</Text>
      <Text className="text-ink-muted text-[9px] font-bold tracking-[2px] mt-0.5">{label}</Text>
    </View>
  );
}
