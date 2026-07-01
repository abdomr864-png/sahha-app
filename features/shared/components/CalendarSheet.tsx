import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';

const WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 0..1 ring fill for the given date. Negative or NaN = no data. */
  getDayCompletion: (date: Date) => number;
  /** Optional press handler when a single day is tapped. */
  onSelectDay?: (date: Date) => void;
}

export function CalendarSheet({ visible, onClose, getDayCompletion, onSelectDay }: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    if (visible) {
      setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
      setMounted(true);
      progress.value = withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, progress, today]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 640 }],
    opacity: progress.value,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.7,
  }));

  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const stats = useMemo(() => {
    let total = 0;
    let online = 0;
    let partial = 0;
    for (const c of cells) {
      if (!c.inMonth) continue;
      if (c.date > today) continue;
      total++;
      const v = getDayCompletion(c.date);
      if (Number.isFinite(v) && v >= 1) online++;
      else if (Number.isFinite(v) && v > 0) partial++;
    }
    return { total, online, partial };
  }, [cells, getDayCompletion, today]);

  const onlinePct = stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 0;

  const monthLabel = `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const isCurrentMonth =
    cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();

  const goPrev = () => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - 1);
    setCursor(d);
  };
  const goNext = () => {
    if (isCurrentMonth) return;
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + 1);
    setCursor(d);
  };

  return (
    <Modal
      visible={mounted}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
          pointerEvents="none"
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close calendar"
        />

        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 18,
              paddingTop: 10,
              backgroundColor: '#14141C',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              borderTopWidth: 1,
              borderColor: '#21212B',
              shadowColor: '#000',
              shadowOpacity: 0.55,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: -10 },
              elevation: 28,
            },
            sheetStyle,
          ]}
        >
          <View className="self-center w-10 h-1 rounded-full bg-border-strong mb-4" />

          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <View className="w-9 h-9 rounded-2xl items-center justify-center bg-bg-raised border border-border">
                <Icon name="calendar" size={16} color="#F4F4F7" />
              </View>
              <View>
                <Text className="text-ink-muted text-[10px] font-extrabold uppercase tracking-[1.5px]">
                  Activity
                </Text>
                <Text
                  className="text-ink text-lg font-extrabold tracking-tight"
                  style={{ marginTop: 1 }}
                >
                  {monthLabel}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center" style={{ gap: 8 }}>
              <NavBtn icon="chevron-left" onPress={goPrev} />
              <NavBtn icon="chevron-right" onPress={goNext} disabled={isCurrentMonth} />
            </View>
          </View>

          {/* Stats row */}
          <View className="flex-row mb-5" style={{ gap: 8 }}>
            <StatPill value={`${stats.online}`} label="Online days" accent="#22C55E" />
            <StatPill value={`${onlinePct}%`} label="Consistency" accent="#84CC16" />
            <StatPill value={`${stats.partial}`} label="Partial" accent="#F59E0B" />
          </View>

          {/* Weekday labels */}
          <View className="flex-row mb-2">
            {WEEK_LABELS.map((w, i) => (
              <View key={`${w}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
                <Text className="text-ink-muted text-[10px] font-extrabold tracking-[1.5px]">
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* Grid */}
          <View>
            {Array.from({ length: 6 }).map((_, row) => (
              <View key={`row-${row}`} className="flex-row" style={{ marginBottom: 4 }}>
                {cells.slice(row * 7, row * 7 + 7).map((cell, col) => {
                  const idx = row * 7 + col;
                  return (
                    <DayCell
                      key={cell.date.toISOString()}
                      date={cell.date}
                      inMonth={cell.inMonth}
                      isToday={isSameDay(cell.date, today)}
                      isFuture={cell.date > today}
                      value={getDayCompletion(cell.date)}
                      onPress={onSelectDay ? () => onSelectDay(cell.date) : undefined}
                      animProgress={progress}
                      animIndex={idx}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View className="flex-row items-center justify-center mt-4" style={{ gap: 14 }}>
            <Legend dotColor="#22C55E" label="Online" />
            <Legend dotColor="#F59E0B" label="Partial" />
            <Legend dotColor="#21212B" label="Off" />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function NavBtn({
  icon,
  onPress,
  disabled,
}: {
  icon: 'chevron-left' | 'chevron-right';
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(0.9, { damping: 18, stiffness: 380 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 380 });
      }}
      hitSlop={8}
    >
      <Animated.View
        style={[
          {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1B1B22',
            borderWidth: 1,
            borderColor: '#21212B',
            opacity: disabled ? 0.35 : 1,
          },
          style,
        ]}
      >
        <Icon name={icon} size={14} color="#F4F4F7" />
      </Animated.View>
    </Pressable>
  );
}

function StatPill({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <View
      className="rounded-2xl border border-border"
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#17171B',
      }}
    >
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent,
            shadowColor: accent,
            shadowOpacity: 0.7,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        <Text
          className="text-ink-muted text-[9px] font-extrabold uppercase"
          style={{ letterSpacing: 1 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        className="text-ink font-extrabold tracking-tight"
        style={{ fontSize: 18, lineHeight: 22, marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
}

function Legend({ dotColor, label }: { dotColor: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
        }}
      />
      <Text className="text-ink-muted text-[11px] font-bold">{label}</Text>
    </View>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  isFuture,
  value,
  onPress,
  animProgress,
  animIndex,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  value: number;
  onPress?: () => void;
  animProgress: SharedValue<number>;
  animIndex: number;
}) {
  const cellStyle = useAnimatedStyle(() => {
    // Stagger by ~14ms per cell — produces a wave from top-left as the sheet opens.
    const delay = animIndex * 0.018;
    const local = Math.max(0, Math.min(1, (animProgress.value - delay) / (1 - delay)));
    const eased = 1 - Math.pow(1 - local, 3);
    return {
      opacity: eased,
      transform: [{ translateY: interpolate(eased, [0, 1], [10, 0]) }],
    };
  });

  const safeValue = Number.isFinite(value) && value > 0 && !isFuture ? value : 0;
  const muted = !inMonth || isFuture;

  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable onPress={onPress} disabled={!onPress} hitSlop={4}>
        <Animated.View
          style={[
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isToday ? '#21212B' : 'transparent',
            },
            cellStyle,
          ]}
        >
          <DayRing
            size={36}
            value={safeValue}
            active={isToday}
            dim={muted}
            number={date.getDate()}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

function DayRing({
  size,
  value,
  active,
  dim,
  number,
}: {
  size: number;
  value: number;
  active: boolean;
  dim: boolean;
  number: number;
}) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const trackColor = active ? '#34343F' : '#21212B';
  const ringColor = pct >= 1 ? '#22C55E' : pct > 0 ? '#F59E0B' : 'transparent';
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={dim ? `${c / 32},${c / 32}` : undefined}
        />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c}`}
            strokeDashoffset={c * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text className={`text-xs font-bold ${dim ? 'text-ink-muted/50' : 'text-ink'}`}>
        {number}
      </Text>
    </View>
  );
}

function buildMonthGrid(cursor: Date): { date: Date; inMonth: boolean }[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid: { date: Date; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    grid.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    grid.push({ date: new Date(year, month, day), inMonth: true });
  }
  while (grid.length < 42) {
    const last = grid[grid.length - 1]!.date;
    grid.push({
      date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      inMonth: false,
    });
  }
  return grid;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
