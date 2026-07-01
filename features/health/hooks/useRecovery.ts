/**
 * Top-level recovery/readiness hook for the home Recovery page. Composes:
 *   - today's wearable snapshot (useTodayHealthMetrics),
 *   - the user's personalized sleep goal (useActivityTargets),
 *   - rolling personal baselines (useRecoveryBaseline, variant-matched),
 *   - training load → ACWR (workouts.total_volume_kg, last 28 local days),
 * then runs the pure math (score, ACWR, deload) from ../recovery.
 *
 * Everything refreshes on Home focus and rolls over at midnight via the same
 * date-keyed query pattern used across the dashboard.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { useActivityTargets } from '@features/onboarding';
import { useTodayHealthMetrics } from './useHealthMetrics';
import { useRecoveryBaseline, type RecoveryBaselineSeries } from './useRecoveryBaseline';
import {
  computeAcwr,
  computeRecoveryScore,
  recommendDeload,
  RECOVERY_CONFIG,
  type AcwrResult,
  type DeloadRecommendation,
  type HrvVariant,
  type RecoveryBaselines,
  type RecoveryInputs,
  type RecoveryScore,
} from '../recovery';

// workouts/health_daily are accessed with loosened typing elsewhere; match it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Local-day key (training is user-logged in local time). */
function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Daily training load (summed volume in kg) for the last `chronicDays`, as a
 * most-recent-LAST array with 0 for rest days — exactly what computeAcwr wants.
 */
function useTrainingLoad() {
  return useQuery<number[]>({
    queryKey: ['recovery-load', new Date().toDateString()],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      const windowDays = RECOVERY_CONFIG.acwr.chronicDays;
      if (!userId) return Array.from({ length: windowDays }, () => 0);

      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (windowDays - 1));
      const { data, error } = await db
        .from('workouts')
        .select('started_at, total_volume_kg')
        .eq('user_id', userId)
        .gte('started_at', since.toISOString());
      if (error) throw error;

      const byDay = new Map<string, number>();
      for (const w of (data ?? []) as { started_at: string; total_volume_kg: number | null }[]) {
        const key = localDay(new Date(w.started_at));
        byDay.set(key, (byDay.get(key) ?? 0) + Number(w.total_volume_kg ?? 0));
      }

      // Build the ascending (most-recent-last) array, 0 for rest days.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const loads: number[] = [];
      for (let i = windowDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        loads.push(byDay.get(localDay(d)) ?? 0);
      }
      return loads;
    },
  });
}

/** Value of a metric for a given UTC day from a daily series, or null. */
function valueOn(series: { day: string; value: number }[], day: string): number | null {
  const row = series.find((d) => d.day === day);
  return row ? row.value : null;
}

/**
 * Reconstruct recent per-day recovery scores from the baseline series, scored
 * against the *current* baseline (training load excluded — it's a per-day
 * wearable approximation used only to detect a multi-day suppression streak).
 * Returns most-recent-last, EXCLUDING today (the caller appends the real,
 * load-inclusive today score).
 */
function reconstructRecentScores(
  series: RecoveryBaselineSeries,
  baselines: RecoveryBaselines,
  variant: HrvVariant | null,
  sleepGoalMin: number,
): (number | null)[] {
  const lookback = RECOVERY_CONFIG.deload.consecutiveDays + 1; // a small buffer
  const out: (number | null)[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hrvSeries = variant === 'RMSSD' ? series.hrvRmssd : series.hrvSdnn;
  for (let i = lookback; i >= 1; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const inputs: RecoveryInputs = {
      restingHr: valueOn(series.restingHr, key),
      hrv: valueOn(hrvSeries, key),
      hrvVariant: variant,
      sleepMinutes: valueOn(series.sleep, key),
      sleepGoalMin,
      acwr: null,
    };
    out.push(computeRecoveryScore(inputs, baselines).score);
  }
  return out;
}

export interface RecoveryResult {
  score: RecoveryScore;
  acwr: AcwrResult;
  deload: DeloadRecommendation;
  baselines: RecoveryBaselines;
  inputs: RecoveryInputs;
  /**
   * Daily training load (kg) for the last `chronicDays`, most-recent-LAST, 0 on
   * rest days — the same array ACWR is computed from. Exposed so downstream
   * consumers (e.g. the readiness engine) can derive rest-day counts and
   * yesterday's load without re-querying workouts (single source of truth).
   */
  loads: number[];
  isLoading: boolean;
}

export function useRecovery(): RecoveryResult {
  const today = useTodayHealthMetrics();
  const targets = useActivityTargets();
  const variant = today.data?.hrvVariant ?? null;
  const baseline = useRecoveryBaseline(variant);
  const load = useTrainingLoad();

  return useMemo<RecoveryResult>(() => {
    const sleepGoalMin = targets.data?.sleepTargetMin ?? 480;
    const baselines: RecoveryBaselines = baseline.data?.baselines ?? {
      restingHr: null,
      hrv: null,
      sleep: null,
      ready: false,
      partial: false,
    };
    const series = baseline.data?.series ?? {
      restingHr: [],
      hrvSdnn: [],
      hrvRmssd: [],
      sleep: [],
    };

    const acwr = computeAcwr(load.data ?? []);
    const inputs: RecoveryInputs = {
      restingHr: today.data?.restingHr ?? null,
      hrv: today.data?.hrv ?? null,
      hrvVariant: variant,
      sleepMinutes: today.data?.sleepMinutes ?? null,
      sleepGoalMin,
      acwr: acwr.ratio,
    };

    const score = computeRecoveryScore(inputs, baselines);
    const recent = [
      ...reconstructRecentScores(series, baselines, variant, sleepGoalMin),
      score.score, // today's real, load-inclusive score anchors the streak
    ];
    const deload = recommendDeload(acwr.ratio, recent);

    return {
      score,
      acwr,
      deload,
      baselines,
      inputs,
      loads: load.data ?? [],
      isLoading: today.isLoading || baseline.isLoading || load.isLoading,
    };
  }, [
    today.data,
    today.isLoading,
    targets.data,
    baseline.data,
    baseline.isLoading,
    load.data,
    load.isLoading,
    variant,
  ]);
}
