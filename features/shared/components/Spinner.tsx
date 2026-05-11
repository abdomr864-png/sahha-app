import { ActivityIndicator, Text, View } from 'react-native';

interface Props {
  inline?: boolean;
  label?: string;
}

export function Spinner({ inline, label }: Props) {
  if (inline) {
    return (
      <View className="flex-row items-center py-2">
        <ActivityIndicator color="#FF4D2E" />
        {label ? <Text className="text-ink-subtle text-sm ml-2">{label}</Text> : null}
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center py-8">
      <View
        className="w-12 h-12 rounded-2xl bg-bg-raised border border-border items-center justify-center"
        style={{
          shadowColor: '#FF4D2E',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <ActivityIndicator color="#FF4D2E" />
      </View>
      {label ? (
        <Text className="text-ink-muted text-xs font-bold tracking-widest mt-3">
          {label.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}
