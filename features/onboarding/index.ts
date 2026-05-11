export { useOnboardingStore } from './store';
export { useCompleteOnboarding } from './hooks/useCompleteOnboarding';
export { onboardingSchema, ACTIVITY_LEVELS, DIET_PREFERENCES, GOAL_PACES } from './schemas';
export type { OnboardingDraft, ActivityLevel, DietPreference, GoalPace } from './schemas';
export { useDailyTargets } from './hooks/useDailyTargets';
export type { DailyTargets } from './hooks/useDailyTargets';
export { useProfile, useUpdateProfile } from './hooks/useProfile';
export type { UserProfile, ProfileUpdate } from './hooks/useProfile';
