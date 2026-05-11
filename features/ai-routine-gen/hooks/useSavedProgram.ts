import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import type { Program } from '@lib/llm';

export interface SavedProgramView {
  id: string;
  goal: string | null;
  is_template: boolean;
  is_ai_generated: boolean;
  created_at: string;
  program: Program & { program_reasoning?: string };
}

interface ProgramRow {
  id: string;
  name: string;
  goal: string | null;
  weeks: number;
  days_per_week: number;
  is_template: boolean;
  is_ai_generated: boolean;
  ai_reasoning: string | null;
  created_at: string;
}
interface DayRow {
  id: string;
  week: number;
  day_index: number;
  name: string | null;
}
interface ExerciseRow {
  id: string;
  program_day_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercises: { name_en: string; muscle_group: string } | null;
}

/**
 * Fetches a saved program by id and reshapes it into the same `Program` type
 * the preview/walkthrough screens consume.
 */
export function useSavedProgram(programId: string | undefined) {
  return useQuery<SavedProgramView | null>({
    queryKey: ['saved-program', programId],
    enabled: !!programId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!programId) return null;

      const [{ data: prog }, { data: days }] = await Promise.all([
        supabase
          .from('programs')
          .select(
            'id, name, goal, weeks, days_per_week, is_template, is_ai_generated, ai_reasoning, created_at',
          )
          .eq('id', programId)
          .maybeSingle(),
        supabase
          .from('program_days')
          .select('id, week, day_index, name')
          .eq('program_id', programId)
          .order('week', { ascending: true })
          .order('day_index', { ascending: true }),
      ]);

      if (!prog) return null;

      const dayIds = (days ?? []).map((d) => d.id as string);
      const { data: exes } = await supabase
        .from('program_exercises')
        .select(
          'id, program_day_id, order_index, target_sets, target_reps, target_rpe, rest_seconds, notes, exercises(name_en, muscle_group)',
        )
        .in('program_day_id', dayIds.length ? dayIds : ['00000000-0000-0000-0000-000000000000'])
        .order('order_index', { ascending: true });
      const p = prog as ProgramRow;
      const dayRows = (days ?? []) as DayRow[];
      const exRows = (exes ?? []) as unknown as ExerciseRow[];

      // Recover original rep range string from notes (saved as `reps: X-Y`),
      // otherwise fall back to the integer target_reps.
      const repsFor = (target: number | null, notes: string | null): string => {
        if (notes) {
          const m = notes.match(/reps:\s*([0-9-]+)/i);
          if (m && m[1]) return m[1];
        }
        return target ? String(target) : '8';
      };

      const days_out: Program['days'] = dayRows.map((d) => ({
        week: d.week,
        day_index: d.day_index,
        name: d.name ?? `Day ${d.day_index + 1}`,
        exercises: exRows
          .filter((e) => e.program_day_id === d.id)
          .map((e) => ({
            name: e.exercises?.name_en ?? 'Exercise',
            muscle_group: e.exercises?.muscle_group ?? '',
            sets: e.target_sets ?? 3,
            reps: repsFor(e.target_reps, e.notes),
            rpe: e.target_rpe ?? undefined,
            rest_seconds: e.rest_seconds ?? 90,
          })),
      }));

      const program: Program & { program_reasoning?: string } = {
        name: p.name,
        description: '',
        weeks: p.weeks,
        days_per_week: p.days_per_week,
        days: days_out,
        program_reasoning: p.ai_reasoning ?? undefined,
      };

      return {
        id: p.id,
        goal: p.goal,
        is_template: p.is_template,
        is_ai_generated: p.is_ai_generated,
        created_at: p.created_at,
        program,
      };
    },
  });
}
