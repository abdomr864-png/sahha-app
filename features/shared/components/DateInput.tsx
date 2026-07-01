import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Icon } from './Icon';

interface Props {
  label?: string;
  /** YYYY-MM-DD string (or empty). */
  value: string;
  onChange: (iso: string) => void;
}

/**
 * Three segmented inputs (DD / MM / YYYY) that auto-advance as the user types
 * and emit a YYYY-MM-DD ISO string. Much faster than typing dashes by hand.
 */
export function DateInput({ label, value, onChange }: Props) {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const dayRef = useRef<TextInput>(null);

  const initial = useMemo(() => splitISO(value), [value]);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [focused, setFocused] = useState<'day' | 'month' | 'year' | null>(null);

  useEffect(() => {
    const iso = combineISO(day, month, year);
    if (iso !== value) onChange(iso);
    // We only push outward when the user types — comparing against value
    // avoids a feedback loop with the prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, month, year]);

  const setDayText = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    setDay(v);
    if (v.length === 2) monthRef.current?.focus();
  };
  const setMonthText = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    setMonth(v);
    if (v.length === 2) yearRef.current?.focus();
  };
  const setYearText = (raw: string) => {
    const v = raw.replace(/\D/g, '').slice(0, 4);
    setYear(v);
  };

  return (
    <View className="mb-4">
      {label ? (
        <Text className="text-ink-muted text-[10px] font-bold tracking-widest mb-2">{label}</Text>
      ) : null}
      <Pressable
        onPress={() => dayRef.current?.focus()}
        className="flex-row items-center bg-bg-raised border border-border rounded-2xl px-3"
        style={{ height: 56 }}
      >
        <View className="mr-3">
          <Icon name="calendar" size={18} color="#B4B4C2" strokeWidth={2.2} />
        </View>

        <Segment
          inputRef={dayRef}
          value={day}
          placeholder="DD"
          onChangeText={setDayText}
          onFocus={() => setFocused('day')}
          onBlur={() => setFocused(null)}
          onKeyBackspaceEmpty={() => undefined}
          maxLength={2}
          width={42}
          active={focused === 'day'}
          returnKeyType="next"
          onSubmitEditing={() => monthRef.current?.focus()}
        />
        <Separator />
        <Segment
          inputRef={monthRef}
          value={month}
          placeholder="MM"
          onChangeText={setMonthText}
          onFocus={() => setFocused('month')}
          onBlur={() => setFocused(null)}
          onKeyBackspaceEmpty={() => dayRef.current?.focus()}
          maxLength={2}
          width={42}
          active={focused === 'month'}
          returnKeyType="next"
          onSubmitEditing={() => yearRef.current?.focus()}
        />
        <Separator />
        <Segment
          inputRef={yearRef}
          value={year}
          placeholder="YYYY"
          onChangeText={setYearText}
          onFocus={() => setFocused('year')}
          onBlur={() => setFocused(null)}
          onKeyBackspaceEmpty={() => monthRef.current?.focus()}
          maxLength={4}
          width={70}
          active={focused === 'year'}
          returnKeyType="done"
        />

        <View style={{ flex: 1 }} />
      </Pressable>
    </View>
  );
}

function Separator() {
  return (
    <Text className="text-ink-muted text-base font-bold mx-1" style={{ marginHorizontal: 4 }}>
      /
    </Text>
  );
}

function Segment({
  inputRef,
  value,
  placeholder,
  onChangeText,
  onFocus,
  onBlur,
  onKeyBackspaceEmpty,
  maxLength,
  width,
  active,
  returnKeyType,
  onSubmitEditing,
}: {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyBackspaceEmpty: () => void;
  maxLength: number;
  width: number;
  active: boolean;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      ref={inputRef}
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyPress={(e) => {
        if (e.nativeEvent.key === 'Backspace' && value.length === 0) {
          onKeyBackspaceEmpty();
        }
      }}
      placeholder={placeholder}
      placeholderTextColor="#52525B"
      keyboardType="number-pad"
      maxLength={maxLength}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      style={{
        width,
        color: '#F4F4F7',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 1,
        paddingVertical: 0,
        height: 40,
        borderBottomWidth: 2,
        borderBottomColor: active ? '#FF4D2E' : 'transparent',
      }}
    />
  );
}

function splitISO(iso: string): { day: string; month: string; year: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return { day: '', month: '', year: '' };
  return { year: m[1]!, month: m[2]!, day: m[3]! };
}

function combineISO(day: string, month: string, year: string): string {
  if (year.length !== 4 || month.length === 0 || day.length === 0) return '';
  const mm = month.padStart(2, '0');
  const dd = day.padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
