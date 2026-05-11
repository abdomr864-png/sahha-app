import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { PressableProps, ViewStyle } from 'react-native';

type Tone = 'default' | 'raised' | 'accent' | 'outline';

interface Props {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  onPress?: PressableProps['onPress'];
  style?: ViewStyle;
  padded?: boolean;
}

const tones: Record<Tone, string> = {
  default: 'bg-bg-subtle border border-border',
  raised: 'bg-bg-raised border border-border',
  accent: 'bg-bg-raised border border-accent/40',
  outline: 'bg-transparent border border-border',
};

export function Card({
  children,
  tone = 'raised',
  className = '',
  onPress,
  style,
  padded = true,
}: Props) {
  const base = `rounded-3xl ${padded ? 'p-5' : ''} ${tones[tone]} ${className}`;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          style,
          pressed ? { transform: [{ scale: 0.99 }], opacity: 0.92 } : null,
        ]}
        className={base}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={base} style={style}>
      {children}
    </View>
  );
}
