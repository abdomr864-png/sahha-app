import { View } from 'react-native';

interface Props {
  total: number;
  current: number;
}

export function StepDots({ total, current }: Props) {
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <View
            key={i}
            style={{
              height: 4,
              borderRadius: 4,
              backgroundColor: done ? '#FF4D2E' : active ? '#FF4D2E' : '#21212B',
              flex: active ? 2 : 1,
            }}
          />
        );
      })}
    </View>
  );
}
