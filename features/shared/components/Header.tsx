import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { IconButton } from './IconButton';
import { useSafeBack } from '../hooks/useSafeBack';

interface Props {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
  onBack?: () => void;
}

export function Header({ title, subtitle, showBack, right, onBack }: Props) {
  const safeBack = useSafeBack('/(tabs)');
  return (
    <View className="flex-row items-center justify-between mb-6">
      <View className="flex-row items-center flex-1">
        {showBack ? (
          <View className="mr-3">
            <IconButton
              icon="chevron-left"
              onPress={onBack ?? safeBack}
              accessibilityLabel="Back"
            />
          </View>
        ) : null}
        <View className="flex-1">
          {title ? (
            <Text className="text-ink text-2xl font-extrabold tracking-tight">{title}</Text>
          ) : null}
          {subtitle ? <Text className="text-ink-subtle text-sm mt-0.5">{subtitle}</Text> : null}
        </View>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}
