import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import type { ActivityLevel, DietPreference, GoalPace } from '../schemas';

export interface DailyTargets {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const FALLBACK: DailyTargets = {
  kcal: 2400,
  proteinG: 160,
  carbsG: 280,
  fatG: 75,
};

const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

interface ProfileSlice {
  sex: 'male' | 'female' | 'other' | null;
  dob: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: 'hypertrophy' | 'strength' | 'recomp' | 'general' | null;
  activity_level: ActivityLevel | null;
  diet_preference: DietPreference | null;
  goal_pace: GoalPace | null;
  target_weight_kg: number | null;
}

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 30;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const before =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (before) age -= 1;
  return Math.max(14, Math.min(90, age));
}

function bmrMifflinStJeor(p: {
  sex: ProfileSlice['sex'];
  weight_kg: number;
  height_cm: number;
  age: number;
}): number {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  if (p.sex === 'male') return base + 5;
  if (p.sex === 'female') return base - 161;
  return base - 78; // average for "other"
}

function paceDelta(pace: GoalPace): number {
  if (pace === 'slow') return 250;
  if (pace === 'aggressive') return 750;
  return 500;
}

function calorieAdjustment(p: {
  goal: ProfileSlice['goal'];
  pace: GoalPace;
  weight_kg: number;
  target_weight_kg: number;
}): number {
  const delta = paceDelta(p.pace);
  if (p.goal === 'hypertrophy') return delta;
  if (p.goal === 'strength') return Math.round(delta * 0.6);
  if (p.goal === 'recomp') return -Math.round(delta * 0.5);
  // general: follow target weight direction
  if (p.target_weight_kg > p.weight_kg + 1) return delta;
  if (p.target_weight_kg < p.weight_kg - 1) return -delta;
  return 0;
}

function macroSplit(diet: DietPreference): {
  protein: number;
  carbs: number;
  fat: number;
} {
  if (diet === 'keto') return { protein: 0.3, carbs: 0.07, fat: 0.63 };
  if (diet === 'low_carb') return { protein: 0.32, carbs: 0.25, fat: 0.43 };
  if (diet === 'vegan') return { protein: 0.25, carbs: 0.5, fat: 0.25 };
  if (diet === 'vegetarian') return { protein: 0.27, carbs: 0.45, fat: 0.28 };
  return { protein: 0.3, carbs: 0.45, fat: 0.25 }; // omnivore
}

export function computeTargets(profile: ProfileSlice): DailyTargets {
  const {
    sex,
    dob,
    height_cm,
    weight_kg,
    goal,
    activity_level,
    diet_preference,
    goal_pace,
    target_weight_kg,
  } = profile;

  if (!height_cm || !weight_kg || !dob || !activity_level) return FALLBACK;

  const age = ageFromDob(dob);
  const bmr = bmrMifflinStJeor({ sex, weight_kg, height_cm, age });
  const tdee = bmr * ACTIVITY_MULT[activity_level];

  const adj = calorieAdjustment({
    goal,
    pace: goal_pace ?? 'standard',
    weight_kg,
    target_weight_kg: target_weight_kg ?? weight_kg,
  });
  const kcal = Math.max(1200, Math.round(tdee + adj));

  const split = macroSplit(diet_preference ?? 'omnivore');
  const proteinG = Math.round((kcal * split.protein) / 4);
  const carbsG = Math.round((kcal * split.carbs) / 4);
  const fatG = Math.round((kcal * split.fat) / 9);

  return { kcal, proteinG, carbsG, fatG };
}

/**
 * Reads the current user's profile and computes personalized daily targets.
 * Falls back to a neutral default when the profile is incomplete.
 */
export function useDailyTargets() {
  return useQuery<DailyTargets>({
    queryKey: ['daily-targets'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return FALLBACK;
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'sex,dob,height_cm,weight_kg,goal,activity_level,diet_preference,goal_pace,target_weight_kg',
        )
        .eq('user_id', userId)
        .maybeSingle();
      if (error || !data) return FALLBACK;
      return computeTargets(data as unknown as ProfileSlice);
    },
  });
}
