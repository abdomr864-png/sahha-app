/**
 * Rolling personal baselines for the recovery score. Reads the `health_daily`
 * aggregate view (one avg value per day per metric) over the baseline window and
 * turns each series into a mean/SD baseline via the pure math in ../recovery.
 *
 * HRV is fetched as two independent series — hrv_sdnn (iOS) and hrv_rmssd
 * (Android) — and NEVER merged. The active variant is chosen to match today's
 * reading by the caller (useRecovery), passed in here so the exposed baseline
 * already carries the right variant.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { buildBaseline, RECOVERY_CONFIG } from '../recovery';
import type { Baseline, HrvVariant, RecoveryBaselines } from '../recovery';

// health_daily is newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** One day's aggregate value for a metric. */
export interface DayValue {
  day: string; // YYYY-MM-DD
  value: number;
}

/** Raw per-metric daily series over the window (ascending by day). */
export interface RecoveryBaselineSeries {
  restingHr: DayValue[];
  hrvSdnn: DayValue[];
  hrvRmssd: DayValue[];
  sleep: DayValue[];
}

export interface RecoveryBaselineResult {
  baselines: RecoveryBaselines;
  /** Raw daily series, reused to reconstruct recent per-day scores. */
  series: RecoveryBaselineSeries;
}

const BASELINE_METRICS = ['resting_hr', 'hrv_sdnn', 'hrv_rmssd', 'sleep'] as const;

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const EMPTY_SERIES: RecoveryBaselineSeries = {
  restingHr: [],
  hrvSdnn: [],
  hrvRmssd: [],
  sleep: [],
};

/** Has some history but not enough to trust a baseline yet. */
function isPartial(series: RecoveryBaselineSeries): boolean {
  const lens = [
    series.restingHr.length,
    series.hrvSdnn.length,
    series.hrvRmssd.length,
    series.sleep.length,
  ];
  return lens.some((n) => n > 0 && n < RECOVERY_CONFIG.minHistoryDays);
}

/** Compose the typed baselines for a given active HRV variant (never mixes). */
export function composeBaselines(
  series: RecoveryBaselineSeries,
  variant: HrvVariant | null,
): RecoveryBaselines {
  const restingHr = buildBaseline(series.restingHr.map((d) => d.value));
  const sleep = buildBaseline(series.sleep.map((d) => d.value));

  // Only build the variant that matches today's reading. When no variant is
  // known yet (no reading today), prefer whichever series actually has data so
  // the baseline is still useful — but still tagged with its own variant.
  let hrv: (Baseline & { variant: HrvVariant }) | null = null;
  const wantSdnn =
    variant === 'SDNN' || (variant == null && series.hrvSdnn.length >= series.hrvRmssd.length);
  if (variant === 'SDNN' || (variant == null && wantSdnn)) {
    const b = buildBaseline(series.hrvSdnn.map((d) => d.value));
    if (b) hrv = { ...b, variant: 'SDNN' };
  }
  if (hrv == null && (variant === 'RMSSD' || variant == null)) {
    const b = buildBaseline(series.hrvRmssd.map((d) => d.value));
    if (b) hrv = { ...b, variant: 'RMSSD' };
  }

  const ready = restingHr != null || sleep != null || hrv != null;
  return { restingHr, hrv, sleep, ready, partial: !ready && isPartial(series) };
}

/**
 * Fetch the baseline series and compose baselines for `variant`. Same
 * staleTime / date-keyed / focus-refetch pattern as useTodayHealthMetrics, so
 * it refreshes on Home focus and rolls over at midnight.
 */
export function useRecoveryBaseline(variant: HrvVariant | null) {
  return useQuery<RecoveryBaselineResult>({
    queryKey: ['recovery-baseline', variant ?? 'auto', new Date().toDateString()],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId)
        return { baselines: composeBaselines(EMPTY_SERIES, variant), series: EMPTY_SERIES };

      const since = utcDay(
        new Date(Date.now() - (RECOVERY_CONFIG.baselineWindowDays - 1) * 86_400_000),
      );
      const { data, error } = await db
        .from('health_daily')
        .select('metric_type, day, value')
        .eq('user_id', userId)
        .in('metric_type', BASELINE_METRICS as unknown as string[])
        .gte('day', since)
        .order('day', { ascending: true });
      if (error) throw error;

      const series: RecoveryBaselineSeries = {
        restingHr: [],
        hrvSdnn: [],
        hrvRmssd: [],
        sleep: [],
      };
      for (const r of (data ?? []) as { metric_type: string; day: string; value: number }[]) {
        const entry = { day: r.day, value: Number(r.value) };
        if (r.metric_type === 'resting_hr') series.restingHr.push(entry);
        else if (r.metric_type === 'hrv_sdnn') series.hrvSdnn.push(entry);
        else if (r.metric_type === 'hrv_rmssd') series.hrvRmssd.push(entry);
        else if (r.metric_type === 'sleep') series.sleep.push(entry);
      }

      return { baselines: composeBaselines(series, variant), series };
    },
  });
}
