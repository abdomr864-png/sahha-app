import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function OnboardingFooter({ label, onPress, disabled, loading }: Props) {
  const insets = useSafeAreaInsets();
  const press = useSharedValue(0);
  const isDisabled = !!disabled || !!loading;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - press.value * 0.025, { damping: 18, stiffness: 240 }) }],
  }));

  return (
    <View
      style={{
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 14,
        paddingHorizontal: 20,
      }}
    >
      <AnimatedPressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPressIn={() => {
          press.value = 1;
        }}
        onPressOut={() => {
          press.value = 0;
        }}
        onPress={onPress}
        style={[animStyle, { borderRadius: 18, overflow: 'hidden' }]}
      >
        <LinearGradient
          colors={isDisabled ? ['#34343F', '#21212B'] : ['#FF6E4F', '#FF4D2E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 20,
            borderRadius: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '800',
                  letterSpacing: 0.4,
                  opacity: isDisabled ? 0.7 : 1,
                }}
              >
                {label}
              </Text>
              <View style={{ marginLeft: 8 }}>
                <Icon name="arrow-right" size={18} color="#FFFFFF" strokeWidth={2.6} />
              </View>
            </>
          )}
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );
}
