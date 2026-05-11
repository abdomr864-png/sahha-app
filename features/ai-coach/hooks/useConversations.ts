import { useQuery } from '@tanstack/react-query';
import { supabase } from '@lib/supabase/client';
import { mapSb } from '@lib/supabase/errors';

export interface ConversationRow {
  id: string;
  title: string | null;
  last_message_at: string;
  created_at: string;
  last_message_preview: string | null;
  message_count: number;
}

export interface MessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export function useConversations() {
  return useQuery<ConversationRow[]>({
    queryKey: ['ai-conversations'],
    staleTime: 30_000,
    queryFn: async () => {
      const data = await mapSb(
        supabase
          .from('ai_conversations')
          .select('id, title, last_message_at, created_at, last_message_preview, message_count')
          .order('last_message_at', { ascending: false })
          .limit(50),
      );
      return (data as ConversationRow[]).map((c) => ({
        ...c,
        last_message_preview: c.last_message_preview ?? null,
        message_count: c.message_count ?? 0,
      }));
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery<MessageRow[]>({
    queryKey: ['ai-messages', conversationId],
    enabled: !!conversationId,
    staleTime: 0,
    queryFn: async () => {
      if (!conversationId) return [];
      const data = await mapSb(
        supabase
          .from('ai_messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      );
      return data as MessageRow[];
    },
  });
}

// Lightweight snapshot used in the coach hub header so the user sees the same
// context the coach is using (current streak, training this week, top muscle).
// Reads only RLS-scoped tables, so a stale or missing row just returns nulls.
export interface CoachSnapshot {
  current_streak: number;
  weekly_completions: number;
  weekly_target: number;
  workouts_7d: number;
  top_muscle_7d: string | null;
  recent_pr: { exercise: string; value: number; unit: string } | null;
}

export function useCoachSnapshot() {
  return useQuery<CoachSnapshot>({
    queryKey: ['ai-coach-snapshot'],
    staleTime: 60_000,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

      const [streakRes, workoutsRes, prRes] = await Promise.all([
        supabase
          .from('user_streaks')
          .select('current_streak, current_week_completions, current_week_target')
          .maybeSingle(),
        supabase
          .from('workouts')
          .select(
            'id, workout_exercises:workout_exercises(exercises:exercises(muscle_group), workout_sets:workout_sets(is_warmup))',
          )
          .gte('started_at', sevenDaysAgo),
        supabase
          .from('personal_records')
          .select('record_type, value, unit, exercises:exercises(name_en)')
          .order('achieved_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const streak = (streakRes.data ?? null) as {
        current_streak?: number;
        current_week_completions?: number;
        current_week_target?: number;
      } | null;

      const workouts = (workoutsRes.data ?? []) as Array<{
        workout_exercises?: Array<{
          exercises?: { muscle_group?: string } | null;
          workout_sets?: Array<{ is_warmup?: boolean }>;
        }>;
      }>;

      const muscleCount = new Map<string, number>();
      for (const w of workouts) {
        for (const we of w.workout_exercises ?? []) {
          const muscle = we.exercises?.muscle_group;
          if (!muscle) continue;
          const sets = (we.workout_sets ?? []).filter((s) => !s.is_warmup).length;
          muscleCount.set(muscle, (muscleCount.get(muscle) ?? 0) + sets);
        }
      }
      const topMuscle =
        Array.from(muscleCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const pr = prRes.data as {
        record_type: string;
        value: number;
        unit: string;
        exercises?: { name_en?: string };
      } | null;

      return {
        current_streak: streak?.current_streak ?? 0,
        weekly_completions: streak?.current_week_completions ?? 0,
        weekly_target: streak?.current_week_target ?? 3,
        workouts_7d: workouts.length,
        top_muscle_7d: topMuscle,
        recent_pr: pr
          ? {
              exercise: pr.exercises?.name_en ?? 'PR',
              value: Number(pr.value),
              unit: pr.unit ?? 'kg',
            }
          : null,
      };
    },
  });
}
