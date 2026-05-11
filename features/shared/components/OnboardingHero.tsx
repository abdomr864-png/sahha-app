import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  size?: number;
}

/**
 * Big circular hero icon displayed at the top of onboarding question screens.
 * Animated halo pulses outward to draw the eye.
 */
export function OnboardingHero({ icon, size = 88 }: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.6 }],
    opacity: 0.55 * (1 - pulse.value),
  }));

  const halo2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 1.0 }],
    opacity: 0.3 * (1 - pulse.value),
  }));

  return (
    <View
      style={{
        height: size + 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: '#FF4D2E',
          },
          halo2Style,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: '#FF4D2E',
          },
          haloStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#FF4D2E',
          shadowOpacity: 0.55,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['#FF6E4F', '#FF4D2E', '#E63B1E']}
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
        <Icon name={icon} size={Math.round(size * 0.42)} color="#FFFFFF" strokeWidth={2.4} />
      </View>
    </View>
  );
}
