import type { Weekday } from '../schemas';

/**
 * Map training_days_per_week → default scheduled weekdays.
 * Source of truth: shared with the SQL fallback in 0024 — keep both in step.
 *
 *   1 → Wed              (single deload-friendly mid-week slot)
 *   2 → Tue, Sat
 *   3 → Mon, Wed, Fri
 *   4 → Mon, Tue, Thu, Fri
 *   5 → Mon, Tue, Wed, Fri, Sat
 *   6 → Mon, Tue, Wed, Fri, Sat, Sun
 *   7 → every day
 *
 * 0=Sun, 1=Mon ... 6=Sat (matches JS Date.getDay()).
 */
export function defaultScheduledDays(daysPerWeek: number | null | undefined): Weekday[] {
  switch (daysPerWeek) {
    case 1:
      return [3];
    case 2:
      return [2, 6];
    case 3:
      return [1, 3, 5];
    case 4:
      return [1, 2, 4, 5];
    case 5:
      return [1, 2, 3, 5, 6];
    case 6:
      return [1, 2, 3, 5, 6, 0];
    case 7:
      return [0, 1, 2, 3, 4, 5, 6];
    default:
      return [1, 3, 5];
  }
}

export function nextScheduledDay(
  scheduledDays: readonly Weekday[],
  from: Date = new Date(),
): Date | null {
  if (scheduledDays.length === 0) return null;
  const sorted = [...scheduledDays].sort((a, b) => a - b);
  const today = from.getDay() as Weekday;
  // Find the next slot today-or-later in the week.
  for (const d of sorted) {
    if (d >= today) {
      const offset = d - today;
      const out = new Date(from);
      out.setDate(out.getDate() + offset);
      out.setHours(0, 0, 0, 0);
      return out;
    }
  }
  // Otherwise wrap to next week's first scheduled day.
  const first = sorted[0]!;
  const offset = 7 - today + first;
  const out = new Date(from);
  out.setDate(out.getDate() + offset);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function isScheduledToday(
  scheduledDays: readonly Weekday[],
  isFlexible: boolean,
  now: Date = new Date(),
): boolean {
  if (isFlexible) return true;
  return scheduledDays.includes(now.getDay() as Weekday);
}

const WEEKDAY_LABEL_KEYS = [
  'streaks.weekday.sun',
  'streaks.weekday.mon',
  'streaks.weekday.tue',
  'streaks.weekday.wed',
  'streaks.weekday.thu',
  'streaks.weekday.fri',
  'streaks.weekday.sat',
] as const;

export function weekdayLabelKey(d: Weekday): string {
  return WEEKDAY_LABEL_KEYS[d]!;
}
