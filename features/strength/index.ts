// Screens & components
export { StrengthScreen } from './components/StrengthScreen';
export { LevelUpCelebration } from './components/LevelUpCelebration';
export { CompositeHeader } from './components/CompositeHeader';
export { LiftLevelCard } from './components/LiftLevelCard';
export { BadgeGallery } from './components/BadgeGallery';

// Hooks
export {
  useStrengthOverview,
  useStrengthEstimates,
  useUserBadges,
  buildStrengthOverview,
  STRENGTH_KEYS,
} from './hooks/useStrength';
export type { LiftView, StrengthOverview } from './hooks/useStrength';
export { useRecomputeStrength, useStrengthSync } from './hooks/useRecomputeStrength';

// Store
export { useCelebrationStore } from './store';
export type { Celebration } from './store';

// Domain types & config (for callers that need levels/lifts)
export type { StrengthLevel } from './config/levels';
export { STRENGTH_LEVELS, LEVEL_COLOR } from './config/levels';
export { LIFTS, LIFT_IDS } from './config/lifts';
export type { LiftId } from './config/lifts';
export type { StrengthEstimateRow, UserBadgeRow } from './schemas';

// Service (for non-focus triggers, e.g. after finishing a workout)
export { recomputeStrength } from './services/recompute';
