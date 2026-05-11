import { Image, View, Text } from 'react-native';

interface Props {
  url?: string | null;
  name?: string | null;
  size?: number;
}

export function Avatar({ url, name, size = 40 }: Props) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return (
      <Image source={{ uri: url }} style={dim} className="bg-bg-subtle border border-border" />
    );
  }
  return (
    <View style={dim} className="items-center justify-center bg-accent/20 border border-accent/30">
      <Text className="text-accent font-extrabold" style={{ fontSize: size * 0.42 }}>
        {initial}
      </Text>
    </View>
  );
}
