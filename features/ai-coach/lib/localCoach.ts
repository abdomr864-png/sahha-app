import type { CoachSnapshot } from '../hooks/useConversations';

// Used when the live AI backend can't be reached. Reads the same snapshot the
// real coach uses so answers stay grounded. Matches on EN / FR / AR keywords
// because the user can type in any of the three languages — the previous
// English-only matcher fell through to the generic reply for non-English
// questions.
//
// Helpers below use a single regex per topic that ORs together translations of
// the same concept. Arabic is matched on bare words (no diacritics) since the
// user keyboard rarely produces them.

const RX = {
  squat: /\b(squat|squats|accroupi|squats?\s|قرفصاء|سكوات)\b/i,
  deadlift: /\b(deadlift|soulev[ée] de terre|سوليفيه|ديدليفت|رفعة ميتة)\b/i,
  bench: /\b(bench|d[ée]velopp[ée] couch[ée]|بنش|ديفلوبيه)\b/i,
  pullup: /\b(pull[\s-]?up|chin[\s-]?up|traction|عقلة|سحب|tractions?)\b/i,
  ohp: /\b(ohp|overhead press|shoulder press|d[ée]velopp[ée] militaire|كتف|ضغط الكتف)\b/i,

  reps: /\b(rep range|set range|how many (sets|reps)|combien de (s[ée]ries|r[ée]p[ée]titions|reps)|كم تكرار|عدد التكرارات|عدد المجموعات)\b/i,
  frequency:
    /\b(how often|frequency|how many days|per week|combien de fois|fr[ée]quence|par semaine|كم مرة|في الأسبوع|عدد الأيام)\b/i,
  rest: /\b(rest (time|day|period)|how long between|temps de repos|repos entre|راحة|مدة الراحة|بين المجموعات)\b/i,
  warmup: /\b(warm[\s-]?up|[ée]chauffement|إحماء|تسخين)\b/i,
  cardio: /\b(cardio|courir|course|run|jog|تمارين القلب|كارديو|جري|الركض)\b/i,

  fatLoss:
    /\b(fat loss|lose (weight|fat)|cutting|cut|burn fat|perdre (du )?poids|s[ée]che|maigrir|br[uû]ler|تخسيس|نقص الوزن|خسارة الدهون|تجفيف|تنشيف)\b/i,
  muscleGain:
    /\b(gain (weight|muscle|mass)|build muscle|bulk|bulking|prendre du muscle|prise de masse|تضخيم|بناء العضلات|زيادة الوزن|كتلة عضلية)\b/i,
  protein: /\b(protein|prot[ée]ines?|بروتين)\b/i,
  supplements:
    /\b(supplement|creatine|pre[\s-]?workout|bcaa|whey|cr[ée]atine|compl[ée]ments?|مكملات|كرياتين|واي)\b/i,

  workout:
    /\b(workout|train|gym|exercise|lift|plan today|push|pull|leg day|entra[îi]nement|s[ée]ance|programme|musculation|تمرين|تدريب|جلسة|برنامج)\b/i,
  recovery:
    /\b(recover|sleep|rest|tired|sore|energy|deload|r[ée]cup[ée]ration|sommeil|fatigu[ée]|courbatures|تعافي|نوم|راحة|إرهاق|تعب)\b/i,
  nutrition:
    /\b(macro|calorie|nutrition|eat|food|meal|hungry|carb|fat|manger|repas|nourriture|aliments|glucides|lipides|أكل|طعام|وجبة|كربوهيدرات|دهون|سعرات)\b/i,
  progress:
    /\b(progress|pr|record|improve|stall|plateau|stuck|progr[ée]s|am[ée]liorer|bloqu[ée]|تقدم|تحسن|سجل شخصي|عالق)\b/i,
  greet:
    /^(\s*)(hi|hello|hey|sup|yo|salam|salut|bonjour|bonsoir|coucou|مرحبا|اهلا|سلام|السلام|hola)\b/i,
};

export function generateLocalReply(message: string, snapshot: CoachSnapshot | undefined): string {
  const streak = snapshot?.current_streak ?? 0;
  const workouts = snapshot?.workouts_7d ?? 0;
  const topMuscle = snapshot?.top_muscle_7d ?? null;
  const pr = snapshot?.recent_pr ?? null;
  const target = snapshot?.weekly_target ?? 3;
  const done = snapshot?.weekly_completions ?? 0;

  if (RX.squat.test(message)) {
    return [
      '**Squat — key points:**',
      "- Brace your core like you're about to take a punch",
      '- Feet shoulder-width, toes slightly out (10–30°)',
      '- Sit back AND down — knees track over toes',
      '- Hip crease below the knee if mobility allows',
      '- Drive through the mid-foot, chest tall',
      '',
      'Fixes: knees caving → cue "spread the floor". Heels lifting → ankle mobility. Lower-back rounding → drop weight, brace harder.',
    ].join('\n');
  }
  if (RX.deadlift.test(message)) {
    return [
      '**Deadlift — key points:**',
      '- Bar over mid-foot, shins almost touching it before you grip',
      '- Hips higher than knees, lower than shoulders',
      '- Lats engaged (think "protect your armpits")',
      "- Push the floor away, don't yank the bar",
      '- Bar stays glued to your legs the whole pull',
      '- Lock out by squeezing glutes, NOT leaning back',
      '',
      'Back rounding = drop the weight. Mixed grip or straps help once it gets heavy.',
    ].join('\n');
  }
  if (RX.bench.test(message)) {
    return [
      '**Bench press — key points:**',
      '- Shoulder blades pulled back and down, glued to the bench',
      '- Slight natural arch in the back',
      '- Feet planted, drive through them',
      '- Bar touches mid-chest / lower-sternum',
      '- Elbows ~45–75° from the body, not flared 90°',
      '- Wrists stacked over elbows',
      '',
      'Shoulders hurt? Tuck elbows more, narrower grip. Stalled? Try paused reps.',
    ].join('\n');
  }
  if (RX.pullup.test(message)) {
    return [
      '**Pull-ups / chin-ups:**',
      '- Dead hang start, shoulders engaged (not loose)',
      '- Drive elbows down and back, chin over the bar',
      '- Lower under control — the eccentric is half the work',
      '',
      "Can't do one yet? Build with: negatives (jump up, lower for 5s), banded pull-ups, or inverted rows. 3–5 sets near failure, 3× per week.",
    ].join('\n');
  }
  if (RX.ohp.test(message)) {
    return [
      '**Overhead press:**',
      '- Bar on the front delts, elbows slightly in front',
      '- Squeeze glutes, brace core — full-body lift',
      '- Press up and slightly back, finish with bar over mid-foot',
      '- "Push your head through the window" at lockout',
      '',
      'No leaning back. If form breaks, drop the weight.',
    ].join('\n');
  }

  if (RX.reps.test(message)) {
    return [
      '**Rep ranges by goal:**',
      '- **Strength:** 3–6 reps × 3–5 sets, RPE 7–9, 2–4 min rest',
      '- **Hypertrophy:** 6–12 reps × 3–5 sets, RPE 7–9, 60–120s rest',
      '- **Endurance:** 12–20+ reps × 2–4 sets, shorter rest',
      '',
      'Mix it: heavy compounds (5–8 reps), moderate accessories (8–12), some high-rep finishers (12–20). Weekly sets per muscle: 10–20.',
    ].join('\n');
  }
  if (RX.frequency.test(message)) {
    return [
      '**Training frequency:**',
      '- Beginner: 3 full-body sessions/week',
      '- Intermediate: 4 — upper/lower split',
      '- Advanced: 5–6 — push/pull/legs or body-part splits',
      '',
      'Hit each muscle group **2× per week** for best growth. At least one full rest day weekly.',
    ].join('\n');
  }
  if (RX.rest.test(message)) {
    return [
      '**Rest between sets:**',
      '- Heavy compounds: 2–4 min',
      '- Moderate hypertrophy: 60–120s',
      '- Isolation / finishers: 30–60s',
      '',
      "Can't hit your reps on the next set? You rested too little.",
    ].join('\n');
  }
  if (RX.warmup.test(message)) {
    return [
      '**Warm-up (5–10 min):**',
      '- 3–5 min light cardio',
      '- Dynamic mobility for target muscles',
      '- Empty bar / light weight: 1–2 sets of the main lift',
      '- Pyramid up: 50%, 70%, 85% of working weight',
      '',
      "Don't static-stretch cold — save it for after.",
    ].join('\n');
  }
  if (RX.cardio.test(message)) {
    return [
      '**Cardio (paired with lifting):**',
      '- Low-intensity: 30–45 min walk, 3–5× / week — recovery-friendly',
      '- Moderate steady-state: 20–30 min, 2–3× / week — heart health',
      '- HIIT: 10–20 min, 1–2× / week — efficient, recovery-costly',
      '',
      "If you're trying to gain muscle, keep cardio modest (it taxes recovery). For fat loss, walking is king — 8–10k steps daily.",
    ].join('\n');
  }

  if (RX.fatLoss.test(message)) {
    return [
      '**Fat loss without losing muscle:**',
      '- ~500 cal/day below maintenance — aim for 0.5–1% bodyweight loss / week',
      '- **Protein high:** 1g per lb bodyweight (non-negotiable)',
      '- Lift heavy 3–5×/week — gives your body a reason to keep muscle',
      '- 8–10k steps daily',
      '- 7–9h sleep — under-sleeping spikes hunger hormones',
      '',
      "Don't go ultra-low calorie. Slow and steady wins.",
    ].join('\n');
  }
  if (RX.muscleGain.test(message)) {
    return [
      '**Muscle gain:**',
      '- Calories: 200–400 over maintenance — 0.25–0.5% bodyweight gain / week',
      '- Protein: 0.8–1g per lb bodyweight',
      '- Lift hard 4–5×/week, progressively overload',
      '- 7–9h sleep',
      '- 12–20 weekly sets per muscle',
      '',
      'Newbies: ~2 lbs of muscle/month. Intermediate: ~1 lb. Too big a surplus = more fat than muscle.',
    ].join('\n');
  }
  if (RX.protein.test(message)) {
    return [
      '**Protein:**',
      '- Target: **0.7–1g per lb of bodyweight** daily',
      '- Spread across 3–5 meals, 25–40g each',
      '- Sources: chicken, beef, fish, eggs, Greek yogurt, whey, lentils, tofu',
      '- Hardest meal: breakfast — try eggs + Greek yogurt',
      '',
      'More than 1g/lb has diminishing returns. Under 0.6g/lb leaves gains on the table.',
    ].join('\n');
  }
  if (RX.supplements.test(message)) {
    return [
      '**Supplements that actually work:**',
      '- **Creatine monohydrate:** 5g/day every day. Cheap, safe, effective.',
      '- **Whey protein:** convenience for hitting your target',
      '- **Caffeine:** 200–400mg pre-workout',
      '- **Vitamin D + omega-3:** if your diet is gappy',
      '',
      'Skip BCAAs (useless if protein is adequate), fat burners, "test boosters". Real food + training does 95%.',
    ].join('\n');
  }

  if (RX.workout.test(message)) {
    const muscleNote =
      topMuscle === 'chest' || topMuscle === 'shoulders'
        ? 'Upper body has been the focus — pulling or legs would balance it.'
        : topMuscle === 'back' || topMuscle === 'biceps'
          ? "You've been hitting pulling muscles — push or legs rounds out the week."
          : topMuscle === 'quads' || topMuscle === 'hamstrings' || topMuscle === 'glutes'
            ? 'Legs have been the focus — upper-body fits well today.'
            : "Hit muscles you haven't trained in the last 48–72h.";
    return [
      `Week so far: ${workouts} workouts${topMuscle ? `, focus on ${topMuscle}` : ''}. ${muscleNote}`,
      '',
      "**Today's template:**",
      '- Warm-up: 5 min cardio + mobility',
      '- Main lift: 4 sets × 5–8 reps at RPE 7–8',
      '- 2–3 accessories: 3 sets × 8–12 reps',
      '- Optional finisher: 8–10 min',
      '',
      'Tell me your equipment and I can be specific.',
    ].join('\n');
  }
  if (RX.recovery.test(message)) {
    if (streak > 5 && workouts >= 4) {
      return [
        `You're on a ${streak}-day streak with ${workouts} sessions this week — your body's working hard.`,
        '',
        '**Recovery checklist:**',
        '- 7–9 hours of sleep tonight',
        '- Watch for low mood, low motivation, stalled lifts (overreaching signs)',
        '- Deload every 4–6 weeks is normal',
        '',
        'Feeling rundown? Swap the workout for mobility + a walk.',
      ].join('\n');
    }
    return [
      'Recovery is where progress actually happens.',
      '',
      '**Quick checklist:**',
      '- 7–9h sleep, dark cool room',
      '- Protein at every meal (0.7–1g per lb)',
      '- Light walks between hard sessions',
      '- Short evening wind-down — stress is recovery debt',
    ].join('\n');
  }
  if (RX.nutrition.test(message)) {
    return [
      '**Daily targets (general lifter):**',
      '- Protein: 0.7–1.0g per lb bodyweight',
      '- Carbs: scale with training intensity (more on heavy days)',
      '- Fat: ~25–30% of calories',
      '- Water: 3–4 L if training hard',
      '',
      "For your next meal: protein + a fist of carbs. Tell me what you're thinking and I'll critique it.",
    ].join('\n');
  }
  if (RX.progress.test(message)) {
    const prLine = pr
      ? `Recent PR: ${pr.exercise} at ${pr.value}${pr.unit}.`
      : "Once you log a few sets I'll track PRs with you.";
    return [
      prLine,
      '',
      '**Where progress comes from:**',
      '- Consistency: 3–5 sessions/week, every week',
      '- Progressive overload: small weekly bumps',
      '- Sleep + protein — non-negotiable',
      '- Deload every 4–6 weeks',
      '',
      streak > 0
        ? `You're on a ${streak}-day streak. Keep showing up.`
        : "Lock in 3 sessions this week. That's where the next PR starts.",
    ].join('\n');
  }

  if (RX.greet.test(message)) {
    return [
      "Hey — I'm your coach. Training, recovery, nutrition, progress — ask me anything.",
      '',
      `From your data: ${workouts} workouts in the last 7 days${streak > 0 ? `, ${streak}-day streak` : ''}.`,
      '',
      "What's on your mind?",
    ].join('\n');
  }

  // Catch-all — still tries to give the user *something* about their question
  // by echoing what they asked, instead of a pure data dump.
  const trimmedQ = message.trim().slice(0, 120);
  return [
    `On "${trimmedQ}" — I don't have enough specifics from just that to give you a sharp answer. Here's the general playbook:`,
    '',
    '- **Train hard:** 3–5 sessions/week, each muscle 2×',
    '- **Eat right:** ~1g protein per lb, calories matched to your goal',
    '- **Sleep:** 7–9h, non-negotiable',
    '- **Be patient:** progress shows up over months',
    '',
    `Where you stand: ${workouts} workouts in 7 days, ${done}/${target} on this week's target${streak > 0 ? `, ${streak}-day streak` : ''}.`,
    '',
    'Try rephrasing with a specific topic — squat form, fat loss, protein, training frequency, supplements, cardio, recovery.',
  ].join('\n');
}
