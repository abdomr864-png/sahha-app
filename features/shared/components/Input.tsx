import { useState } from 'react';
import { Pressable, TextInput, View, Text } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Icon, type IconName } from './Icon';

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  icon?: IconName;
  password?: boolean;
  trailing?: string;
}

export function Input({ label, error, icon, password, trailing, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  const borderClass = error ? 'border-danger' : focused ? 'border-accent' : 'border-border';
  const iconColor = error ? '#F87171' : focused ? '#FF4D2E' : '#A1A1AA';

  return (
    <View className="mb-4">
      {label ? (
        <Text className="text-ink-muted text-[10px] font-bold mb-2 uppercase tracking-widest">
          {label}
        </Text>
      ) : null}
      <View
        className={`flex-row items-center bg-bg-raised rounded-2xl border ${borderClass} px-4`}
        style={{ height: 54 }}
      >
        {icon ? (
          <View className="mr-3">
            <Icon name={icon} size={18} color={iconColor} />
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
        {trailing ? (
          <Text className="text-ink-muted text-xs ml-2 font-semibold uppercase tracking-wider">
            {trailing}
          </Text>
        ) : null}
        {password ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            className="ml-2 p-1"
            accessibilityRole="button"
          >
            <Icon name={visible ? 'eye' : 'eye-off'} size={18} color="#A1A1AA" />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-danger text-xs mt-1.5">{error}</Text> : null}
    </View>
  );
}
