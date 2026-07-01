import { Pressable, Text } from 'react-native';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  size?: 'sm' | 'md';
}

export function Chip({ label, active, onPress, icon, size = 'md' }: Props) {
  const padding = size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2.5';
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-full border ${padding} ${
        active ? 'bg-accent border-accent' : 'bg-bg-raised border-border'
      }`}
    >
      {icon ? <Icon name={icon} size={14} color={active ? '#FFFFFF' : '#B4B4C2'} /> : null}
      <Text
        className={`${size === 'sm' ? 'text-xs' : 'text-sm'} font-semibold ${
          active ? 'text-accent-contrast' : 'text-ink-subtle'
        } ${icon ? 'ml-1.5' : ''}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
