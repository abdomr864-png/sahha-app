import { Image, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  url?: string | null;
  name?: string | null;
  size?: number;
}

// Vibrant gradient avatars (Sahha design) — deterministic per name so a given
// user always gets the same color.
const GRADIENTS: [string, string][] = [
  ['#FF6B8A', '#C9184A'],
  ['#FF8A2B', '#FF2D55'],
  ['#34E89E', '#12B886'],
  ['#B06BFF', '#6366F1'],
  ['#2BD2FF', '#3B82F6'],
  ['#F5C451', '#FF8A2B'],
];

export function Avatar({ url, name, size = 40 }: Props) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return (
      <Image source={{ uri: url }} style={dim} className="bg-bg-subtle border border-border" />
    );
  }
  const code = (name ?? '?').charCodeAt(0) || 0;
  const colors = GRADIENTS[code % GRADIENTS.length]!;
  return (
    <View style={dim} className="items-center justify-center overflow-hidden">
      <LinearGradient
        colors={colors as unknown as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <Text className="text-white font-extrabold" style={{ fontSize: size * 0.4 }}>
        {initial}
      </Text>
    </View>
  );
}
