import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StreakEvent, StreakEventType } from '../schemas';

const CELL = 14;
const GAP = 3;
const WEEKS = 26; // ~6 months

/**
 * Color per event type. Severity is ordered so a single day with multiple
 * events (e.g. completed + milestone) renders the most informative bucket.
 */
const TYPE_PRIORITY: Record<StreakEventType, number> = {
  completed: 5,
  milestone: 5,
  bonus_completed: 4,
  freeze_used: 3,
  recovery_week: 2,
  missed: 1,
  rest_day: 0,
  week_completed: 0,
  reset: 0,
};

const TYPE_COLOR: Record<StreakEventType, string> = {
  completed: '#22C55E',
  milestone: '#22C55E',
  bonus_completed: '#86EFAC',
  freeze_used: '#FACC15',
  recovery_week: '#FB923C',
  missed: '#EF4444',
  rest_day: '#27272F',
  week_completed: '#27272F',
  reset: '#27272F',
};

interface DayBucket {
  date: string;
  best: StreakEventType | null;
}

function buildGrid(events: StreakEvent[]): DayBucket[] {
  const map = new Map<string, StreakEventType>();
  for (const e of events) {
    const prev = map.get(e.event_date);
    if (!prev || TYPE_PRIORITY[e.event_type] > TYPE_PRIORITY[prev]) {
      map.set(e.event_date, e.event_type);
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (WEEKS * 7 - 1));
  // Align start to Sunday so columns are full weeks.
  start.setDate(start.getDate() - start.getDay());
  const cells: DayBucket[] = [];
  const cursor = new Date(start);
  const last = new Date(today);
  while (cursor <= last) {
    const iso = cursor.toISOString().slice(0, 10);
    cells.push({ date: iso, best: map.get(iso) ?? null });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

export function HeatmapGrid({ events }: { events: StreakEvent[] }) {
  const { t } = useTranslation();
  const grid = useMemo(() => buildGrid(events), [events]);

  // Lay out as columns of 7 (rows = Sun..Sat).
  const columns: DayBucket[][] = [];
  for (let i = 0; i < grid.length; i += 7) {
    columns.push(grid.slice(i, i + 7));
  }

  return (
    <View>
      <View className="flex-row" style={{ gap: GAP }}>
        {columns.map((col, ci) => (
          <View key={ci} style={{ gap: GAP }}>
            {col.map((cell) => {
              const color = cell.best ? TYPE_COLOR[cell.best] : '#1A1A1F';
              return (
                <View
                  key={cell.date}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 3,
                    backgroundColor: color,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap mt-3" style={{ gap: 10 }}>
        <Legend color={TYPE_COLOR.completed} label={t('streaks.legend.completed')} />
        <Legend color={TYPE_COLOR.bonus_completed} label={t('streaks.legend.bonus')} />
        <Legend color={TYPE_COLOR.freeze_used} label={t('streaks.legend.freeze')} />
        <Legend color={TYPE_COLOR.recovery_week} label={t('streaks.legend.recovery')} />
        <Legend color={TYPE_COLOR.missed} label={t('streaks.legend.missed')} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text className="text-ink-subtle text-[11px]">{label}</Text>
    </View>
  );
}
