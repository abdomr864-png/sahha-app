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

// Routes where the bottom tab bar should be fully hidden. The AI Coach tab is
// a full-bleed chat surface: the keyboard composer needs the screen edge, and
// the tab buttons would otherwise overlap it.
const HIDDEN_ROUTES = new Set(['coach']);

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRoute = state.routes[state.index]?.name;
  if (currentRoute && HIDDEN_ROUTES.has(currentRoute)) return null;
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
          height: 70,
          borderRadius: 30,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 12,
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

          // Center "Coach" tab — raised violet orb (Sahha design).
          if (route.name === 'coach') {
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
                  className="items-center justify-center overflow-hidden rounded-full"
                  style={{
                    width: 54,
                    height: 54,
                    marginTop: -26,
                    shadowColor: '#6366F1',
                    shadowOpacity: 0.55,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 10,
                  }}
                >
                  <LinearGradient
                    colors={
                      ['#B06BFF', '#6366F1'] as unknown as readonly [string, string, ...string[]]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                  <Icon name="sparkles" size={24} color="#FFFFFF" strokeWidth={2.2} />
                </View>
                <Text
                  className={`text-[10px] mt-1 tracking-wider uppercase ${
                    focused ? 'text-ink font-extrabold' : 'text-ink-muted font-bold'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              className="flex-1 items-center justify-center"
              style={{ height: '100%' }}
            >
              <Icon
                name={icon}
                size={22}
                color={focused ? '#F4F4F7' : '#74748A'}
                strokeWidth={focused ? 2.3 : 1.9}
              />
              <Text
                className={`text-[10px] mt-1 tracking-wider uppercase ${
                  focused ? 'text-ink font-extrabold' : 'text-ink-muted font-bold'
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
