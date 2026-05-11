import db from './exerciseDb.json';

export interface ExerciseInfo {
  id: string;
  name: string;
  level?: string;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  imageCount: number;
}

const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';

// Maps the exercise names produced by the stub generator (and likely the AI)
// to verified IDs in the free-exercise-db dataset.
const NAME_TO_ID: Record<string, string> = {
  // Chest
  'barbell bench press': 'Barbell_Bench_Press_-_Medium_Grip',
  'incline dumbbell press': 'Incline_Dumbbell_Press',
  'cable fly': 'Cable_Crossover',
  'cable crossover': 'Cable_Crossover',
  'dumbbell bench press': 'Dumbbell_Bench_Press',
  'dumbbell fly': 'Dumbbell_Flyes',
  'dumbbell flyes': 'Dumbbell_Flyes',
  'push-up': 'Pushups',
  pushup: 'Pushups',
  pushups: 'Pushups',
  'decline push-up': 'Decline_Barbell_Bench_Press',
  'diamond push-up': 'Pushups',
  'banded chest press': 'Pushups',

  // Back
  'pull-up': 'Pullups',
  pullup: 'Pullups',
  pullups: 'Pullups',
  'chin-up': 'Chin-Up',
  'barbell row': 'Bent_Over_Barbell_Row',
  'bent over barbell row': 'Bent_Over_Barbell_Row',
  'lat pulldown': 'Wide-Grip_Lat_Pulldown',
  'wide-grip lat pulldown': 'Wide-Grip_Lat_Pulldown',
  'seated cable row': 'Seated_Cable_Rows',
  'one-arm dumbbell row': 'One-Arm_Dumbbell_Row',
  'one-arm row': 'One-Arm_Dumbbell_Row',
  'inverted row': 'Inverted_Row',
  'dumbbell pullover': 'Bent-Arm_Dumbbell_Pullover',
  'banded row': 'One-Arm_Dumbbell_Row',

  // Shoulders
  'overhead press': 'Standing_Military_Press',
  'standing military press': 'Standing_Military_Press',
  'dumbbell shoulder press': 'Seated_Dumbbell_Press',
  'dumbbell lateral raise': 'Side_Lateral_Raise',
  'side lateral raise': 'Side_Lateral_Raise',
  'lateral raise': 'Side_Lateral_Raise',
  'banded lateral raise': 'Side_Lateral_Raise',
  'pike push-up': 'Pushups',
  'handstand hold': 'Handstand_Push-Ups',

  // Rear delts
  'cable rear delt fly': 'Reverse_Flyes_With_External_Rotation',
  'reverse pec deck': 'Reverse_Flyes',
  'reverse flyes': 'Reverse_Flyes',
  'bent-over reverse fly': 'Reverse_Flyes',
  'reverse snow angel': 'Reverse_Flyes',
  'banded rear delt fly': 'Reverse_Flyes',

  // Biceps
  'barbell curl': 'Barbell_Curl',
  'incline dumbbell curl': 'Incline_Dumbbell_Curl',
  'dumbbell curl': 'Dumbbell_Bicep_Curl',
  'dumbbell bicep curl': 'Dumbbell_Bicep_Curl',
  'hammer curl': 'Hammer_Curls',
  'hammer curls': 'Hammer_Curls',
  'banded curl': 'Dumbbell_Bicep_Curl',

  // Triceps
  'cable pushdown': 'Triceps_Pushdown',
  'tricep pushdown': 'Triceps_Pushdown',
  'triceps pushdown': 'Triceps_Pushdown',
  skullcrusher: 'EZ-Bar_Skullcrusher',
  'ez-bar skullcrusher': 'EZ-Bar_Skullcrusher',
  'close-grip bench press': 'Smith_Machine_Close-Grip_Bench_Press',
  'dumbbell overhead extension': 'Seated_Triceps_Press',
  'seated triceps press': 'Seated_Triceps_Press',
  'dumbbell kickback': 'Tricep_Dumbbell_Kickback',
  'tricep dumbbell kickback': 'Tricep_Dumbbell_Kickback',
  'banded pushdown': 'Triceps_Pushdown',
  'bench dip': 'Bench_Dips',
  'bench dips': 'Bench_Dips',

  // Quads
  'back squat': 'Barbell_Squat',
  'barbell squat': 'Barbell_Squat',
  'leg press': 'Leg_Press',
  'leg extension': 'Leg_Extensions',
  'leg extensions': 'Leg_Extensions',
  'goblet squat': 'Goblet_Squat',
  'bulgarian split squat': 'Split_Squat_with_Dumbbells',
  'bodyweight squat': 'Bodyweight_Squat',
  'reverse lunge': 'Dumbbell_Lunges',
  'dumbbell lunges': 'Dumbbell_Lunges',

  // Hamstrings & Glutes
  'romanian deadlift': 'Romanian_Deadlift',
  'dumbbell romanian deadlift': 'Romanian_Deadlift',
  'lying leg curl': 'Lying_Leg_Curls',
  'lying leg curls': 'Lying_Leg_Curls',
  'hip thrust': 'Barbell_Hip_Thrust',
  'dumbbell hip thrust': 'Barbell_Hip_Thrust',
  'banded hip thrust': 'Barbell_Hip_Thrust',
  'glute bridge': 'Barbell_Glute_Bridge',
  'single-leg rdl': 'Single_Leg_Glute_Bridge',
  'single-leg hip hinge': 'Romanian_Deadlift',

  // Calves
  'standing calf raise': 'Standing_Calf_Raises',
  'standing calf raises': 'Standing_Calf_Raises',
  'dumbbell calf raise': 'Dumbbell_Seated_One-Leg_Calf_Raise',
  'calf raise': 'Standing_Calf_Raises',

  // Traps
  'barbell shrug': 'Barbell_Shrug',
  'dumbbell shrug': 'Dumbbell_Shrug',
  'banded shrug': 'Barbell_Shrug',
  'y-raise': 'Reverse_Flyes',

  // Core
  'hanging leg raise': 'Hanging_Leg_Raise',
  'cable crunch': 'Cable_Crunch',
  plank: 'Plank',
  'dumbbell russian twist': 'Russian_Twist',
  'russian twist': 'Russian_Twist',
  'bicycle crunch': 'Air_Bike',
  'hollow body hold': 'Plank',
};

export function exerciseIdFor(name: string): string | null {
  return NAME_TO_ID[name.trim().toLowerCase()] ?? null;
}

export function exerciseImageUrl(name: string, index = 0): string | null {
  const id = exerciseIdFor(name);
  if (!id) return null;
  return `${CDN}/${id}/${index}.jpg`;
}

export function exerciseInfo(name: string): ExerciseInfo | null {
  const id = exerciseIdFor(name);
  if (!id) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = (db as Record<string, any>)[id];
  if (!entry) return null;
  return { id, ...entry };
}

export function exerciseImages(name: string): string[] {
  const info = exerciseInfo(name);
  if (!info) return [];
  return Array.from({ length: info.imageCount }, (_, i) => `${CDN}/${info.id}/${i}.jpg`);
}
