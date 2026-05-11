import { View } from 'react-native';

interface Props {
  color?: string;
  size?: number;
  opacity?: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Decorative blurred radial glow used for premium dark backgrounds.
 * Stacks 3 concentric circles with decreasing alpha to fake a soft blur
 * (no native blur lib needed).
 */
export function Glow({
  color = '#FF4D2E',
  size = 320,
  opacity = 0.18,
  top,
  bottom,
  left,
  right,
}: Props) {
  const pos = { top, bottom, left, right };
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        ...pos,
      }}
    >
      <View
        style={{
          position: 'absolute',
          inset: 0,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity: opacity * 0.4,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: size * 0.12,
          width: size * 0.76,
          height: size * 0.76,
          borderRadius: size,
          backgroundColor: color,
          opacity: opacity * 0.7,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.28,
          left: size * 0.28,
          width: size * 0.44,
          height: size * 0.44,
          borderRadius: size,
          backgroundColor: color,
          opacity,
        }}
      />
    </View>
  );
}
