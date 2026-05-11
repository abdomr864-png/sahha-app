import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from './Icon';

const ICONS: Record<string, IconName> = {
  index: 'home',
  feed: 'users',
  coach: 'sparkles',
  progress: 'trending',
  profile: 'user',
  train: 'dumbbell',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, 14),
        paddingHorizontal: 14,
        paddingTop: 8,
      }}
    >
      <View
        className="flex-row items-center justify-between bg-bg-raised border border-border px-2"
        style={{
          height: 72,
          borderRadius: 28,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 10,
        }}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const descriptor = descriptors[route.key];
          const options = descriptor?.options;
          const label =
            typeof options?.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options?.title ?? route.name);
          const icon = ICONS[route.name] ?? 'home';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              className="flex-1 items-center justify-center"
              style={{ height: '100%' }}
            >
              <View
                className="items-center justify-center overflow-hidden"
                style={{
                  width: 46,
                  height: 36,
                  borderRadius: 18,
                  shadowColor: focused ? '#FF4D2E' : 'transparent',
                  shadowOpacity: focused ? 0.5 : 0,
                  shadowRadius: focused ? 12 : 0,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: focused ? 6 : 0,
                }}
              >
                {focused ? (
                  <LinearGradient
                    colors={
                      ['#FF4D2E', '#F97316'] as unknown as readonly [string, string, ...string[]]
                    }
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
                ) : null}
                <Icon
                  name={icon}
                  size={focused ? 22 : 20}
                  color={focused ? '#FFFFFF' : '#A1A1AA'}
                  strokeWidth={focused ? 2.4 : 1.9}
                />
              </View>
              <Text
                className={`text-[10px] mt-1 tracking-wider uppercase ${
                  focused ? 'text-accent font-extrabold' : 'text-ink-muted font-bold'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
