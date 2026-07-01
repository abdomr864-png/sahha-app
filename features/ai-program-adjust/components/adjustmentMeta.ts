import type { IconName } from '@features/shared';
import type { Adjustment } from '@lib/llm';

type AdjType = Adjustment['adjustments'][number]['type'];

export interface AdjMeta {
  icon: IconName;
  color: string; // hex, drives icon + tile tint (alpha-suffixed) + chip
}

/** Per-adjustment-type icon + color so each suggestion reads at a glance. */
export const ADJ_META: Record<AdjType, AdjMeta> = {
  increase_weight: { icon: 'arrow-up', color: '#2EE6A6' },
  decrease_weight: { icon: 'scale', color: '#F5C451' },
  change_reps: { icon: 'edit', color: '#2BD2FF' },
  swap_exercise: { icon: 'zap', color: '#A855F7' },
  add_set: { icon: 'plus', color: '#FF8A2B' },
  deload: { icon: 'heart', color: '#2BD2FF' },
};

/**
 * Short, human "what changes" chip for a suggestion — e.g. "+2.5 kg",
 * "→ 4 sets", "8–10 reps". Falls back to the type label when detail is sparse.
 */
export function deltaLabel(a: Adjustment['adjustments'][number], fallback: string): string {
  const d = (a.detail ?? {}) as Record<string, unknown>;
  switch (a.type) {
    case 'increase_weight':
      return d.delta_kg != null ? `+${d.delta_kg} kg` : fallback;
    case 'decrease_weight':
      return d.delta_kg != null ? `−${d.delta_kg} kg` : fallback;
    case 'change_reps':
      return typeof d.new_reps === 'string' && d.new_reps ? `${d.new_reps} reps` : fallback;
    case 'add_set':
      return typeof d.new_sets === 'number' ? `→ ${d.new_sets} sets` : fallback;
    case 'swap_exercise':
      return typeof d.swap_to === 'string' && d.swap_to ? `→ ${d.swap_to}` : fallback;
    case 'deload':
      return fallback;
    default:
      return fallback;
  }
}
