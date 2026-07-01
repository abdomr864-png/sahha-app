import { useState } from 'react';
import { Pressable, TextInput, View, Text } from 'react-native';
import type { TextInputProps } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type IconName = 'mail' | 'lock';

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  icon?: IconName;
  password?: boolean;
}

const ICON_COLOR_IDLE = '#B4B4C2';
const ICON_COLOR_ACTIVE = '#FF4D2E';

function FieldIcon({ name, color }: { name: IconName; color: string }) {
  if (name === 'mail') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
          stroke={color}
          strokeWidth={1.8}
        />
        <Path d="m4 8 8 5 8-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 10V8a6 6 0 1 1 12 0v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
        stroke={color}
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke={color} strokeWidth={1.8} />
      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke={color} strokeWidth={1.8} />
      {!open ? (
        <Path d="M4 4l16 16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

export function AuthField({ label, error, icon, password, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const borderClass = error ? 'border-danger' : focused ? 'border-accent' : 'border-border';

  const iconColor = error ? '#FF4D6D' : focused ? ICON_COLOR_ACTIVE : ICON_COLOR_IDLE;

  return (
    <View className="mb-4">
      {label ? (
        <Text className="text-ink-subtle text-xs font-medium mb-2 uppercase tracking-wider">
          {label}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center bg-bg-raised rounded-2xl border ${borderClass} px-4`}
        style={{ height: 54 }}
      >
        {icon ? (
          <View className="mr-3">
            <FieldIcon name={icon} color={iconColor} />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor="#52525B"
          className="flex-1 text-ink text-base"
          style={{ paddingVertical: 0 }}
          secureTextEntry={password && !visible}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            className="ml-2 p-1"
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={visible} color={ICON_COLOR_IDLE} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-danger text-xs mt-1.5">{error}</Text> : null}
    </View>
  );
}
