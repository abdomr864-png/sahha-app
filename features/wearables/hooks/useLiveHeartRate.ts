import { useEffect, useState } from 'react';
import { getHealthDataProvider } from '@lib/health-data';

const POLL_MS = 5_000;

/**
 * Live heart-rate poller for in-app workout sessions. Re-reads the most
 * recent HR sample every 5s. Caller decides when to mount.
 *
 * No persistence — this is a UI feed, not a sync target.
 */
export function useLiveHeartRate(active: boolean): {
  bpm: number | null;
  recordedAt: string | null;
} {
  const [state, setState] = useState<{ bpm: number | null; recordedAt: string | null }>({
    bpm: null,
    recordedAt: null,
  });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const provider = getHealthDataProvider();

    const tick = async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 30_000);
      try {
        const samples = await provider.readHeartRate({
          from: from.toISOString(),
          to: to.toISOString(),
        });
        if (cancelled || samples.length === 0) return;
        const latest = samples.reduce((a, b) =>
          new Date(a.recordedAt) > new Date(b.recordedAt) ? a : b,
        );
        setState({ bpm: Math.round(latest.value), recordedAt: latest.recordedAt });
      } catch {
        // ignore — leave previous value visible.
      }
    };

    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  return state;
}
