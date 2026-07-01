import { Pressable } from 'react-native';
import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  onPress?: () => void;
  variant?: 'default' | 'accent' | 'ghost';
  size?: number;
  accessibilityLabel?: string;
}

export function IconButton({
  icon,
  onPress,
  variant = 'default',
  size = 40,
  accessibilityLabel,
}: Props) {
  const bg =
    variant === 'accent'
      ? 'bg-accent border-accent'
      : variant === 'ghost'
        ? 'bg-transparent border-transparent'
        : 'bg-bg-raised border-border';
  const color = variant === 'accent' ? '#FFFFFF' : '#F4F4F7';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`items-center justify-center rounded-full border ${bg}`}
      style={{ width: size, height: size }}
    >
      <Icon name={icon} size={size * 0.45} color={color} />
    </Pressable>
  );
}
