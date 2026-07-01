import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recomputeStrength, type RecomputeResult } from '../services/recompute';
import { useCelebrationStore, type Celebration } from '../store';

function toCelebrations(result: RecomputeResult): Celebration[] {
  return [
    ...result.levelUps.map((e): Celebration => ({ kind: 'level', liftId: e.liftId, level: e.to })),
    ...result.newBadges.map((badgeId): Celebration => ({ kind: 'badge', badgeId })),
  ];
}

/**
 * Mutation that recomputes the user's strength estimates + badges, queues any
 * celebrations, and refreshes the strength queries. Errors are swallowed: a
 * background recompute must never surface an error toast to the user.
 */
export function useRecomputeStrength() {
  const qc = useQueryClient();
  const enqueue = useCelebrationStore((s) => s.enqueue);

  return useMutation({
    mutationFn: recomputeStrength,
    onSuccess: (result) => {
      enqueue(toCelebrations(result));
      qc.invalidateQueries({ queryKey: ['strength'] });
    },
    onError: () => undefined,
  });
}

// Debounce recompute across focus events / screens (module-level, app-wide).
let lastRunAt = 0;
const MIN_INTERVAL_MS = 30_000;

/**
 * Recompute strength when a screen regains focus, debounced app-wide so opening
 * Home then Strength doesn't fire twice. Mirrors the existing on-focus
 * invalidation pattern used by the Home tab.
 */
export function useStrengthSync(): void {
  const recompute = useRecomputeStrength();

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRunAt < MIN_INTERVAL_MS) return;
      lastRunAt = now;
      recompute.mutate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}
