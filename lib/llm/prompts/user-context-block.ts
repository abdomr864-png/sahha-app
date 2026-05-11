// Shared user-context block injected into the workout-gen and program-gen
// system prompts. The numbers come from `_shared/user-context.ts` which queries
// across profiles, workouts, sleep_log, mood_log, meals/meal_items, and PRs.

export interface MuscleVolumeRow {
  muscle_group: string;
  total_sets: number;
  total_volume_kg: number;
}

export interface PrRow {
  exercise_name: string;
  pr_type: string;
  value: number;
  unit: string;
  achieved_at: string; // ISO date
}

export interface UserTrainingContext {
  // Profile basics
  goal?: string | null;
  experience?: string | null;
  bodyweight_kg?: number | null;
  height_cm?: number | null;
  sex?: string | null;
  age?: number | null;
  equipment?: string | null;
  injuries?: string[] | null;

  // Recent training (last 7 days)
  workouts_completed_7d?: number | null;
  muscles_trained_7d?: MuscleVolumeRow[] | null;
  avg_rpe_7d?: number | null;
  hours_since_last_workout?: number | null;

  // Recovery (last 3 days)
  avg_sleep_hours_3d?: number | null;
  avg_sleep_quality_10?: number | null; // rescaled from 1..5 to 1..10
  avg_mood_10?: number | null;
  avg_energy_10?: number | null;
  avg_stress_10?: number | null;

  // Nutrition (today)
  today_calories?: number | null;
  target_calories?: number | null;
  today_protein_g?: number | null;
  target_protein_g?: number | null;

  // PRs (last 30 days)
  recent_prs?: PrRow[] | null;
}

export function userContextBlock(ctx: UserTrainingContext): string {
  const lines: string[] = [];
  lines.push('USER CONTEXT:');
  lines.push(`- Goal: ${ctx.goal ?? 'unspecified'}`);
  lines.push(`- Experience: ${ctx.experience ?? 'unspecified'}`);
  if (ctx.bodyweight_kg) lines.push(`- Bodyweight: ${ctx.bodyweight_kg}kg`);
  if (ctx.height_cm) lines.push(`- Height: ${ctx.height_cm}cm`);
  if (ctx.sex) lines.push(`- Sex: ${ctx.sex}`);
  if (ctx.age) lines.push(`- Age: ${ctx.age}`);
  if (ctx.equipment) lines.push(`- Equipment: ${ctx.equipment}`);
  if (ctx.injuries?.length) lines.push(`- Injuries / limitations: ${ctx.injuries.join(', ')}`);
  else lines.push('- Injuries / limitations: none');

  lines.push('');
  lines.push('RECENT TRAINING (last 7 days):');
  lines.push(`- Workouts completed: ${ctx.workouts_completed_7d ?? 0}`);
  if (ctx.muscles_trained_7d?.length) {
    const summary = ctx.muscles_trained_7d
      .map((m) => `${m.muscle_group}=${m.total_sets} sets / ${Math.round(m.total_volume_kg)}kg vol`)
      .join('; ');
    lines.push(`- Muscles trained: ${summary}`);
  } else {
    lines.push('- Muscles trained: none in window');
  }
  if (ctx.avg_rpe_7d != null) lines.push(`- Average RPE: ${ctx.avg_rpe_7d.toFixed(1)}`);
  if (ctx.hours_since_last_workout != null) {
    lines.push(`- Last training day: ${Math.round(ctx.hours_since_last_workout)}h ago`);
  } else {
    lines.push('- Last training day: no recent workout logged');
  }

  lines.push('');
  lines.push('RECOVERY (last 3 days):');
  if (ctx.avg_sleep_hours_3d != null) {
    lines.push(`- Average sleep duration: ${ctx.avg_sleep_hours_3d.toFixed(1)}h`);
  }
  if (ctx.avg_sleep_quality_10 != null) {
    lines.push(`- Average sleep quality: ${ctx.avg_sleep_quality_10.toFixed(1)}/10`);
  }
  if (ctx.avg_mood_10 != null) lines.push(`- Mood: ${ctx.avg_mood_10.toFixed(1)}/10`);
  if (ctx.avg_energy_10 != null) lines.push(`- Energy: ${ctx.avg_energy_10.toFixed(1)}/10`);
  if (ctx.avg_stress_10 != null) lines.push(`- Stress: ${ctx.avg_stress_10.toFixed(1)}/10`);

  lines.push('');
  lines.push('NUTRITION (today):');
  if (ctx.today_calories != null && ctx.target_calories) {
    const pct = Math.round((ctx.today_calories / ctx.target_calories) * 100);
    lines.push(`- Calories: ${ctx.today_calories} / ${ctx.target_calories} (${pct}%)`);
  } else {
    lines.push('- Calories: not logged');
  }
  if (ctx.today_protein_g != null && ctx.target_protein_g) {
    const pct = Math.round((ctx.today_protein_g / ctx.target_protein_g) * 100);
    lines.push(`- Protein: ${ctx.today_protein_g}g / ${ctx.target_protein_g}g (${pct}%)`);
  } else {
    lines.push('- Protein: not logged');
  }

  lines.push('');
  lines.push('RECENT PRs (last 30 days):');
  if (ctx.recent_prs?.length) {
    for (const pr of ctx.recent_prs.slice(0, 8)) {
      lines.push(
        `- ${pr.exercise_name}: ${pr.pr_type} ${pr.value}${pr.unit} (${pr.achieved_at.slice(0, 10)})`,
      );
    }
  } else {
    lines.push('- None recorded');
  }

  return `\n${lines.join('\n')}\n`;
}
