import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  description?: string;
  icon?: IconName;
  selected?: boolean;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SelectCard({ label, description, icon, selected, onPress }: Props) {
  const press = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 - press.value * 0.02, { damping: 18, stiffness: 220 }) }],
  }));

  const selectedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(selected ? 1 : 0, { duration: 180 }),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        press.value = 1;
      }}
      onPressOut={() => {
        press.value = 0;
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[
        animStyle,
        selected
          ? {
              shadowColor: '#FF4D2E',
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }
          : null,
      ]}
      className={`relative overflow-hidden flex-row items-center rounded-2xl border px-4 py-4 ${
        selected ? 'border-accent' : 'bg-bg-raised border-border'
      }`}
    >
      {selected ? (
        <Animated.View
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, selectedStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['rgba(255,77,46,0.18)', 'rgba(255,77,46,0.04)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}

      {icon ? (
        <View
          className={`w-12 h-12 rounded-2xl items-center justify-center mr-3 ${
            selected ? '' : 'border border-border'
          }`}
          style={
            selected
              ? {
                  shadowColor: '#FF4D2E',
                  shadowOpacity: 0.45,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                }
              : undefined
          }
        >
          {selected ? (
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
                borderRadius: 16,
              }}
            />
          ) : null}
          <Icon name={icon} size={22} color={selected ? '#FFFFFF' : '#FF4D2E'} strokeWidth={2.2} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className={`text-base font-semibold ${selected ? 'text-ink' : 'text-ink'}`}>
          {label}
        </Text>
        {description ? <Text className="text-ink-subtle text-xs mt-0.5">{description}</Text> : null}
      </View>

      <View
        className={`w-7 h-7 rounded-full items-center justify-center ${
          selected ? 'bg-accent' : 'border border-border'
        }`}
      >
        <Icon
          name={selected ? 'check' : 'chevron-right'}
          size={selected ? 16 : 14}
          color={selected ? '#FFFFFF' : '#52525B'}
          strokeWidth={selected ? 3 : 2}
        />
      </View>
    </AnimatedPressable>
  );
}
