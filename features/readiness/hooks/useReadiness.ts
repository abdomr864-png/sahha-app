/**
 * useReadiness — the flagship "what should I do today?" hook.
 *
 * Consumes the EXISTING recovery system (useRecovery: score, band, ACWR, and the
 * shared daily-load array) plus today's optional subjective check-in, runs the
 * pure engine, and:
 *   - upserts one snapshot per local day (throttled by a content signature so we
 *     don't write the same verdict twice), fire-and-forget so offline never
 *     crashes;
 *   - caches the last verdict to local storage so it renders instantly on a cold
 *     / offline launch (offline-first parity, spec rule §6).
 *
 * It NEVER recomputes recovery or load — single source of truth (spec rule §2).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useRecovery } from '@features/health';
import { storage } from '@lib/offline/storage';
import { computeReadiness } from '../engine';
import { upsertSnapshot } from '../repositories/snapshots';
import { useCheckinStore } from '../store';
import { localDayKey } from '../date';
import type { ReadinessInputs, ReadinessVerdict, SubjectiveCheckin } from '../types';

const VERDICT_CACHE_KEY = 'readiness.verdict';
const SYNC_SIG_KEY = 'readiness.syncSig';

interface CachedVerdict {
  date: string;
  verdict: ReadinessVerdict;
  trainingLoadYesterday: number;
}

export interface UseReadinessResult {
  /** Today's verdict, or null only on a first-ever launch with no cache. */
  verdict: ReadinessVerdict | null;
  isLoading: boolean;
  /** True when the verdict came from the offline cache, not a fresh compute. */
  fromCache: boolean;
  checkin: SubjectiveCheckin | null;
  setCheckin: (next: SubjectiveCheckin) => void;
}

function readCache(today: string): CachedVerdict | null {
  const c = storage.getJSON<CachedVerdict>(VERDICT_CACHE_KEY);
  return c && c.date === today ? c : null;
}

export function useReadiness(): UseReadinessResult {
  const recovery = useRecovery();
  const checkin = useCheckinStore((s) => s.checkin);
  const setCheckin = useCheckinStore((s) => s.setCheckin);
  const today = localDayKey(new Date());
  const lastSig = useRef<string | null>(null);

  // Fresh verdict from the live recovery signals (null until any data exists).
  const computed = useMemo<{ verdict: ReadinessVerdict; loadYesterday: number } | null>(() => {
    const loads = recovery.loads;
    // Nothing to score yet on a truly empty cold start.
    if (recovery.isLoading && loads.length === 0 && recovery.score.score === null) return null;
    const restDaysLast7 = loads.slice(-7).filter((v) => v <= 0).length;
    const loadYesterday = loads.length >= 2 ? (loads[loads.length - 2] ?? 0) : 0;
    const inputs: ReadinessInputs = {
      recoveryScore: recovery.score.score,
      recoveryBand: recovery.score.band,
      acwr: recovery.acwr.ratio,
      trainingLoadYesterday: loadYesterday,
      restDaysLast7,
      subjective: checkin,
    };
    return { verdict: computeReadiness(inputs), loadYesterday };
  }, [recovery.score, recovery.acwr, recovery.loads, recovery.isLoading, checkin]);

  // Cache the fresh verdict + upsert the daily snapshot (throttled, best-effort).
  useEffect(() => {
    if (!computed) return;
    const { verdict, loadYesterday } = computed;
    const cache: CachedVerdict = { date: today, verdict, trainingLoadYesterday: loadYesterday };
    storage.setJSON(VERDICT_CACHE_KEY, cache);

    const sig = [
      today,
      verdict.state,
      verdict.adjustment.loadMultiplier,
      recovery.score.score ?? 'na',
      recovery.acwr.ratio ?? 'na',
      checkin ? `${checkin.energy}-${checkin.soreness}` : 'na',
    ].join('|');
    if (sig === lastSig.current || sig === storage.getString(SYNC_SIG_KEY)) return;
    lastSig.current = sig;

    void upsertSnapshot({
      date: today,
      recovery_score: recovery.score.score,
      acwr: recovery.acwr.ratio,
      training_load: loadYesterday,
      state: verdict.state,
      load_multiplier: verdict.adjustment.loadMultiplier,
      rpe_cap: verdict.adjustment.rpeCap,
      inputs: {
        recoveryBand: recovery.score.band,
        restDaysLast7: recovery.loads.slice(-7).filter((v) => v <= 0).length,
        subjective: checkin,
        building: verdict.building,
      },
    })
      .then(() => storage.setString(SYNC_SIG_KEY, sig))
      .catch(() => {
        // Offline / signed out — the local cache still drives the UI.
        lastSig.current = null;
      });
  }, [computed, today, recovery.score, recovery.acwr.ratio, recovery.loads, checkin]);

  // Prefer the fresh verdict; fall back to today's cache when recovery has no
  // data yet (cold / offline launch).
  if (computed) {
    return {
      verdict: computed.verdict,
      isLoading: recovery.isLoading,
      fromCache: false,
      checkin,
      setCheckin,
    };
  }
  const cached = readCache(today);
  return {
    verdict: cached?.verdict ?? null,
    isLoading: recovery.isLoading,
    fromCache: cached != null,
    checkin,
    setCheckin,
  };
}
