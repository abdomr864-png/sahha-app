import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

interface Props {
  size?: number;
}

export function BrandMark({ size = 64 }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#21212B',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF4D2E',
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}
    >
      <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 32 32" fill="none">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FF8A2B" />
            <Stop offset="1" stopColor="#FF4D2E" />
          </LinearGradient>
        </Defs>
        {/* dumbbell */}
        <Path
          d="M5 12h2v8H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm22 0h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2v-8ZM9 9h3v14H9V9Zm11 0h3v14h-3V9Zm-7 5h6v4h-6v-4Z"
          fill="url(#g)"
        />
        <Circle cx="16" cy="16" r="0" />
      </Svg>
    </View>
  );
}
