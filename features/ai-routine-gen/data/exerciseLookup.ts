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

// --- Fuzzy resolution -------------------------------------------------------
// The AI (and the offline stub) emit free-form exercise names that often don't
// match an alias above verbatim ("Barbell Bench Press" vs "bench press",
// "Walking Lunge" vs "Dumbbell Lunges"). Without a match the walkthrough/detail
// sheet render no image and no "how to do it" steps. To make sure *every*
// exercise shows something, we fall back to a normalized, token-overlap search
// across both the alias table and the full exercise DB.

// Filler words that shouldn't drive a match on their own (equipment, position).
const STOP_TOKENS = new Set([
  'the',
  'a',
  'with',
  'and',
  'of',
  'to',
  'machine',
  'cable',
  'barbell',
  'dumbbell',
  'banded',
  'band',
  'seated',
  'standing',
  'lying',
  'bench',
  'smith',
  'ez',
  'bar',
  'grip',
  'wide',
  'close',
]);

// Light stemming so plurals match ("lunges" ↔ "lunge", "flyes" ↔ "fly").
function stem(token: string): string {
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(stem);
}

// Build the candidate index once: every alias key + every DB entry name, mapped
// to its DB id, with a tokenized representation for overlap scoring.
interface Candidate {
  id: string;
  tokens: string[];
}
const CANDIDATES: Candidate[] = (() => {
  const out: Candidate[] = [];
  for (const [alias, id] of Object.entries(NAME_TO_ID)) {
    out.push({ id, tokens: tokenize(alias) });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [id, entry] of Object.entries(db as Record<string, any>)) {
    out.push({ id, tokens: tokenize(entry.name ?? id.replace(/_/g, ' ')) });
  }
  return out;
})();

function fuzzyIdFor(name: string): string | null {
  const queryTokens = tokenize(name);
  if (!queryTokens.length) return null;
  const querySet = new Set(queryTokens);
  const meaningful = queryTokens.filter((t) => !STOP_TOKENS.has(t));

  let best: { id: string; score: number; extra: number } | null = null;
  for (const cand of CANDIDATES) {
    let score = 0;
    for (const tok of cand.tokens) {
      if (!querySet.has(tok)) continue;
      // Weight non-filler tokens higher so "row" beats "barbell".
      score += STOP_TOKENS.has(tok) ? 1 : 3;
    }
    if (score === 0) continue;
    // Prefer candidates that overlap on a meaningful (non-filler) token.
    const overlapsMeaningful = cand.tokens.some(
      (tok) => !STOP_TOKENS.has(tok) && querySet.has(tok),
    );
    if (meaningful.length && !overlapsMeaningful) continue;
    const extra = cand.tokens.filter((tok) => !querySet.has(tok)).length;
    if (!best || score > best.score || (score === best.score && extra < best.extra)) {
      best = { id: cand.id, score, extra };
    }
  }
  return best?.id ?? null;
}

export function exerciseIdFor(name: string): string | null {
  const exact = NAME_TO_ID[name.trim().toLowerCase()];
  if (exact) return exact;
  return fuzzyIdFor(name);
}

// Last-resort image fallback: a representative DB exercise per muscle group, so
// a thumbnail/hero never falls back to a bare icon just because the name didn't
// match. Keyed by the app's muscle_group vocabulary (not the DB's anatomical
// terms). Every id here exists in the DB and has images.
const MUSCLE_FALLBACK_ID: Record<string, string> = {
  chest: 'Dumbbell_Bench_Press',
  back: 'Bent_Over_Barbell_Row',
  lats: 'Pullups',
  shoulders: 'Standing_Military_Press',
  'rear delts': 'Reverse_Flyes',
  biceps: 'Barbell_Curl',
  triceps: 'Triceps_Pushdown',
  arms: 'Barbell_Curl',
  quads: 'Barbell_Squat',
  quadriceps: 'Barbell_Squat',
  legs: 'Barbell_Squat',
  hamstrings: 'Romanian_Deadlift',
  glutes: 'Barbell_Hip_Thrust',
  calves: 'Standing_Calf_Raises',
  traps: 'Barbell_Shrug',
  core: 'Plank',
  abs: 'Plank',
  abdominals: 'Plank',
};

function fallbackIdForMuscle(muscle?: string | null): string | null {
  if (!muscle) return null;
  return MUSCLE_FALLBACK_ID[muscle.trim().toLowerCase()] ?? null;
}

// Resolve a usable DB id from the exercise name, then (if no name match) from
// the muscle group, so an image is always available when a muscle is known.
function resolveId(name: string, muscle?: string | null): string | null {
  return exerciseIdFor(name) ?? fallbackIdForMuscle(muscle);
}

export function exerciseImageUrl(name: string, index = 0, muscle?: string | null): string | null {
  const id = resolveId(name, muscle);
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

// Image frames for a hero/animation. Uses the name match first (so the steps
// and pictures agree); if the name doesn't match but a muscle group is known,
// falls back to a representative exercise's images so a picture still shows.
export function exerciseImages(name: string, muscle?: string | null): string[] {
  const id = resolveId(name, muscle);
  if (!id) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = (db as Record<string, any>)[id];
  const count = entry?.imageCount ?? 0;
  return Array.from({ length: count }, (_, i) => `${CDN}/${id}/${i}.jpg`);
}
