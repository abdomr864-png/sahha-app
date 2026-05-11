import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { PressableProps } from 'react-native';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-4 py-2.5 rounded-xl',
  md: 'px-5 py-3.5 rounded-2xl',
  lg: 'px-6 py-4 rounded-2xl',
};
const labelSize: Record<Size, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-base',
};

const variants: Record<Variant, string> = {
  primary: 'bg-accent border border-accent',
  secondary: 'bg-bg-raised border border-border',
  ghost: 'bg-transparent border border-transparent',
  danger: 'bg-danger border border-danger',
};
const labelStyles: Record<Variant, string> = {
  primary: 'text-accent-contrast font-bold tracking-wide',
  secondary: 'text-ink font-semibold tracking-wide',
  ghost: 'text-ink-subtle font-medium',
  danger: 'text-accent-contrast font-bold tracking-wide',
};
const iconColors: Record<Variant, string> = {
  primary: '#FFFFFF',
  secondary: '#F4F4F5',
  ghost: '#A1A1AA',
  danger: '#FFFFFF',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  iconRight,
  fullWidth = true,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  const shadow =
    variant === 'primary' && !isDisabled
      ? {
          shadowColor: '#FF4D2E',
          shadowOpacity: 0.45,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }
      : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        shadow,
        pressed && !isDisabled ? { transform: [{ scale: 0.98 }] } : null,
      ]}
      className={`flex-row items-center justify-center ${sizeStyles[size]} ${variants[variant]} ${
        isDisabled ? 'opacity-50' : ''
      } ${fullWidth ? 'self-stretch' : 'self-start'}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={iconColors[variant]} />
      ) : (
        <>
          {icon ? (
            <View className="mr-2">
              <Icon name={icon} size={16} color={iconColors[variant]} strokeWidth={2.2} />
            </View>
          ) : null}
          <Text className={`${labelStyles[variant]} ${labelSize[size]}`}>{label}</Text>
          {iconRight ? (
            <View className="ml-2">
              <Icon name={iconRight} size={16} color={iconColors[variant]} strokeWidth={2.2} />
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
