import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  step: number; // 1-indexed for display, e.g. step 1 of 10
  total: number;
  showBack?: boolean;
}

export function OnboardingHeader({ step, total, showBack = true }: Props) {
  const router = useRouter();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(step / total, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, step, total]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View className="mb-8">
      <View className="flex-row items-center" style={{ height: 40 }}>
        {showBack ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            hitSlop={12}
            className="w-10 h-10 rounded-full bg-bg-raised border border-border items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 6l-6 6 6 6"
                stroke="#F4F4F5"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        ) : (
          <View className="w-10 h-10" />
        )}

        <View className="flex-1 px-4">
          <View className="h-1.5 rounded-full bg-bg-raised overflow-hidden border border-border/60">
            <Animated.View style={[{ height: '100%' }, fillStyle]}>
              <LinearGradient
                colors={['#FF6E4F', '#FF4D2E']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1, borderRadius: 999 }}
              />
            </Animated.View>
          </View>
        </View>

        <View
          className="rounded-full px-3 py-1.5"
          style={{
            backgroundColor: 'rgba(255,77,46,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,77,46,0.35)',
          }}
        >
          <Text className="text-accent text-[11px] font-extrabold tracking-widest">
            {step}/{total}
          </Text>
        </View>
      </View>
    </View>
  );
}
