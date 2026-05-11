import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@features/shared';
import { useAuthGateStore } from '../hooks/useAuthGate';
import { BrandMark } from './BrandMark';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AuthGateSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visible = useAuthGateStore((s) => s.visible);
  const message = useAuthGateStore((s) => s.message);
  const close = useAuthGateStore((s) => s.close);

  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, progress]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 480 }],
    opacity: progress.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.65,
  }));

  const go = (route: '/(auth)/sign-in' | '/(auth)/sign-up') => {
    close();
    router.push(route);
  };

  return (
    <Modal
      visible={mounted}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={close}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss" />

        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              paddingHorizontal: 22,
              paddingTop: 14,
              backgroundColor: '#13131A',
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderTopWidth: 1,
              borderColor: '#27272F',
            },
            sheetStyle,
          ]}
        >
          {/* drag handle */}
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#3F3F46',
              marginBottom: 18,
            }}
          />

          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                shadowColor: '#FF4D2E',
                shadowOpacity: 0.5,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 10 },
              }}
            >
              <LinearGradient
                colors={['#FF7A4D', '#FF4D2E', '#D6321A']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <BrandMark size={52} />
            </View>
          </View>

          <Text className="text-ink text-2xl font-extrabold tracking-tight text-center mb-2">
            {t('auth.gate.title', { defaultValue: 'Sign in to continue' })}
          </Text>
          <Text className="text-ink-subtle text-base text-center mb-7" style={{ lineHeight: 22 }}>
            {message ??
              t('auth.gate.subtitle', {
                defaultValue:
                  'Create an account or sign in to save progress, sync across devices, and unlock personalized features.',
              })}
          </Text>

          <PrimaryCTA
            label={t('auth.gate.signUp', { defaultValue: 'Create an account' })}
            onPress={() => go('/(auth)/sign-up')}
          />
          <View style={{ height: 10 }} />
          <SecondaryCTA
            label={t('auth.gate.signIn', { defaultValue: 'I already have an account' })}
            onPress={() => go('/(auth)/sign-in')}
          />

          <Pressable
            onPress={close}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}
          >
            <Text className="text-ink-muted text-sm font-semibold">
              {t('auth.gate.notNow', { defaultValue: 'Not now' })}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PrimaryCTA({ label, onPress }: { label: string; onPress: () => void }) {
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 120 });
      }}
      style={[
        style,
        {
          borderRadius: 18,
          overflow: 'hidden',
          shadowColor: '#FF4D2E',
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
      ]}
    >
      <LinearGradient
        colors={['#FF6E4F', '#FF4D2E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingVertical: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 18,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 }}>
          {label}
        </Text>
        <View style={{ marginLeft: 8 }}>
          <Icon name="arrow-right" size={18} color="#FFFFFF" strokeWidth={2.6} />
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

function SecondaryCTA({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 18,
        backgroundColor: '#1B1B22',
        borderWidth: 1,
        borderColor: '#27272F',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: '#F4F4F5', fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
