import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@features/shared';

type GradientColors = readonly [string, string, ...string[]];

/** Square album art with a branded gradient placeholder when art is missing. */
export function AlbumArt({ uri, size = 44 }: { uri: string | null; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden' }}
      className="border border-border"
    >
      {uri ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <LinearGradient
          colors={['#1DB954', '#0E7A3A'] as unknown as GradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="music" size={size * 0.4} color="#FFFFFF" />
        </LinearGradient>
      )}
    </View>
  );
}
