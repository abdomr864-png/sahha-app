import { Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  value: string;
  unit?: string;
  icon?: IconName;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'flat';
  accent?: boolean;
}

export function StatCard({ label, value, unit, icon, delta, deltaTone = 'flat', accent }: Props) {
  const deltaColor =
    deltaTone === 'up' ? 'text-success' : deltaTone === 'down' ? 'text-danger' : 'text-ink-muted';

  return (
    <View
      className={`flex-1 rounded-2xl px-4 py-4 border ${
        accent ? 'bg-accent/10 border-accent/40' : 'bg-bg-subtle border-border'
      }`}
    >
      <View className="flex-row items-center mb-2">
        {icon ? <Icon name={icon} size={14} color={accent ? '#FF4D2E' : '#B4B4C2'} /> : null}
        <Text
          className={`${
            accent ? 'text-accent' : 'text-ink-muted'
          } text-[10px] font-bold uppercase tracking-widest ${icon ? 'ml-1.5' : ''}`}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline">
        <Text
          className="text-ink text-3xl font-display tracking-tight"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
        {unit ? <Text className="text-ink-muted text-xs ml-1 font-medium">{unit}</Text> : null}
      </View>
      {delta ? <Text className={`${deltaColor} text-xs mt-1 font-semibold`}>{delta}</Text> : null}
    </View>
  );
}
