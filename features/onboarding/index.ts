export { useOnboardingStore } from './store';
export { useCompleteOnboarding } from './hooks/useCompleteOnboarding';
export { hasCompletedOnboarding } from './hooks/hasCompletedOnboarding';
export { onboardingSchema, ACTIVITY_LEVELS, DIET_PREFERENCES, GOAL_PACES } from './schemas';
export type { OnboardingDraft, ActivityLevel, DietPreference, GoalPace } from './schemas';
export { useDailyTargets } from './hooks/useDailyTargets';
export type { DailyTargets } from './hooks/useDailyTargets';
export {
  useActivityTargets,
  resolveActivityTargets,
  ACTIVITY_TARGET_DEFAULTS,
} from './hooks/useActivityTargets';
export type { ActivityTargets } from './hooks/useActivityTargets';
export { useProfile, useUpdateProfile, usePrefetchProfile } from './hooks/useProfile';
export type { UserProfile, ProfileUpdate } from './hooks/useProfile';
