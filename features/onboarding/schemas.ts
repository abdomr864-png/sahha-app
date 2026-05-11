import { z } from 'zod';

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'very', 'extra'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const DIET_PREFERENCES = ['omnivore', 'vegetarian', 'vegan', 'keto', 'low_carb'] as const;
export type DietPreference = (typeof DIET_PREFERENCES)[number];

export const GOAL_PACES = ['slow', 'standard', 'aggressive'] as const;
export type GoalPace = (typeof GOAL_PACES)[number];

export const onboardingSchema = z.object({
  locale: z.enum(['en', 'fr', 'ar']),
  goal: z.enum(['hypertrophy', 'strength', 'recomp', 'general']),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']),
  training_days_per_week: z.number().int().min(1).max(7),
  equipment_access: z.enum(['full_gym', 'home_gym', 'minimal']),
  weight_unit: z.enum(['kg', 'lb']),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/),
  display_name: z.string().min(1).max(40),
  height_cm: z.number().int().min(100).max(250),
  weight_kg: z.number().min(30).max(300),
  sex: z.enum(['male', 'female', 'other']),
  dob: z.string().min(8),
  injuries: z.array(z.string().min(1).max(40)).max(10).optional(),
  activity_level: z.enum(ACTIVITY_LEVELS),
  target_weight_kg: z.number().min(30).max(300),
  diet_preference: z.enum(DIET_PREFERENCES),
  goal_pace: z.enum(GOAL_PACES),
});

export type OnboardingDraft = z.infer<typeof onboardingSchema>;
