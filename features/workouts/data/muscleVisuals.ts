import type { IconName } from '@features/shared';

export interface MuscleVisual {
  from: string;
  to: string;
  icon: IconName;
}

// Per-muscle palette shared by the workout session + AI preview screens so
// generated and live content carry one consistent visual identity.
export const MUSCLE_COLORS: Record<string, MuscleVisual> = {
  chest: { from: '#EF4444', to: '#FF4D6D', icon: 'flame' },
  back: { from: '#3B82F6', to: '#60A5FA', icon: 'trending' },
  lats: { from: '#3B82F6', to: '#60A5FA', icon: 'trending' },
  shoulders: { from: '#F59E0B', to: '#F5C451', icon: 'zap' },
  'rear delts': { from: '#F97316', to: '#FB923C', icon: 'zap' },
  biceps: { from: '#8B5CF6', to: '#A78BFA', icon: 'dumbbell' },
  triceps: { from: '#A855F7', to: '#C084FC', icon: 'dumbbell' },
  arms: { from: '#8B5CF6', to: '#C084FC', icon: 'dumbbell' },
  quads: { from: '#10B981', to: '#2EE6A6', icon: 'target' },
  legs: { from: '#10B981', to: '#2EE6A6', icon: 'target' },
  hamstrings: { from: '#14B8A6', to: '#2DD4BF', icon: 'target' },
  glutes: { from: '#EC4899', to: '#F472B6', icon: 'heart' },
  calves: { from: '#06B6D4', to: '#22D3EE', icon: 'arrow-up' },
  traps: { from: '#64748B', to: '#94A3B8', icon: 'arrow-up' },
  core: { from: '#84CC16', to: '#A3E635', icon: 'target' },
  abs: { from: '#84CC16', to: '#A3E635', icon: 'target' },
};

export const FALLBACK_MUSCLE: MuscleVisual = { from: '#52525B', to: '#74748A', icon: 'dumbbell' };

export const muscleVisual = (m?: string | null): MuscleVisual =>
  (m && MUSCLE_COLORS[m.toLowerCase()]) || FALLBACK_MUSCLE;
