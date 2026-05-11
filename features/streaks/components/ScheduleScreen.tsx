import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Header, Screen } from '@features/shared';
import { useStreak, useUpdateSchedule } from '../hooks/useStreak';
import { defaultScheduledDays, weekdayLabelKey } from '../lib/schedule';
import type { Weekday } from '../schemas';

const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleScreen() {
  const { t } = useTranslation();
  const { data: streak } = useStreak();
  const update = useUpdateSchedule();
  const [selected, setSelected] = useState<Set<Weekday>>(() => new Set([1, 3, 5]));
  const [flexible, setFlexible] = useState(false);

  useEffect(() => {
    if (!streak) return;
    setSelected(new Set(streak.scheduled_days as Weekday[]));
    setFlexible(streak.is_flexible_schedule);
  }, [streak?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDay = (d: Weekday) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const onUseDefault = () => {
    const target = streak?.current_week_target ?? 3;
    setSelected(new Set(defaultScheduledDays(target)));
  };

  const onSave = async () => {
    await update.mutateAsync({
      scheduled_days: Array.from(selected).sort((a, b) => a - b),
      is_flexible_schedule: flexible,
    });
  };

  return (
    <Screen scroll padded={false}>
      <View className="px-5 pt-2">
        <Header
          title={t('streaks.scheduleTitle', { defaultValue: 'Training schedule' })}
          showBack
        />
      </View>
      <View className="px-5 pb-10">
        <View className="bg-bg-raised rounded-3xl border border-border p-4 mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-1 mr-3">
              <Text className="text-ink font-extrabold tracking-tight">
                {t('streaks.flexibleTitle', { defaultValue: 'Flexible mode' })}
              </Text>
              <Text className="text-ink-subtle text-xs mt-0.5">
                {t('streaks.flexibleHelp', {
                  defaultValue: 'Count any workout this week toward the weekly target.',
                })}
              </Text>
            </View>
            <Switch value={flexible} onValueChange={setFlexible} />
          </View>
        </View>

        <View
          className={`bg-bg-raised rounded-3xl border border-border p-4 mb-4 ${
            flexible ? 'opacity-50' : ''
          }`}
        >
          <Text
            className="text-ink-muted text-[10px] font-extrabold uppercase mb-3"
            style={{ letterSpacing: 1.2 }}
          >
            {t('streaks.pickDays', { defaultValue: 'Pick your training days' })}
          </Text>
          <View className="flex-row" style={{ gap: 6 }}>
            {ALL_DAYS.map((d) => {
              const on = selected.has(d);
              return (
                <Pressable
                  key={d}
                  disabled={flexible}
                  onPress={() => toggleDay(d)}
                  className={`flex-1 items-center justify-center rounded-2xl py-3 border ${
                    on ? 'bg-accent/15 border-accent' : 'bg-bg-subtle border-border'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-extrabold uppercase ${
                      on ? 'text-accent' : 'text-ink-muted'
                    }`}
                    style={{ letterSpacing: 1.2 }}
                  >
                    {t(weekdayLabelKey(d), { defaultValue: '' })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onUseDefault} className="mt-3 self-start" disabled={flexible}>
            <Text className="text-accent text-xs font-bold">
              {t('streaks.useSmartDefault', { defaultValue: 'Use smart default' })}
            </Text>
          </Pressable>
        </View>

        <Button
          label={t('common.save', { defaultValue: 'Save' })}
          onPress={onSave}
          loading={update.isPending}
          disabled={!flexible && selected.size === 0}
        />
      </View>
    </Screen>
  );
}
