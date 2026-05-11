import { supabase } from '@lib/supabase/client';
import { toAppError } from '@lib/supabase/errors';
import { nextSessionSuggestion, type NextSessionSuggestion } from '../schemas';

const COLUMNS =
  'id,user_id,exercise_id,program_exercise_id,suggested_weight_kg,suggested_reps,suggested_sets,reasoning,is_pr_attempt,created_at,expires_at,consumed_at';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/**
 * Latest unconsumed, unexpired suggestion for the given exercise (if any).
 */
export async function fetchSuggestionForExercise(
  exerciseId: string,
): Promise<NextSessionSuggestion | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('next_session_suggestions')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? nextSessionSuggestion.parse(data) : null;
}

export async function markSuggestion(
  suggestionId: string,
  decision: 'accepted' | 'declined',
): Promise<void> {
  const { error } = await supabase
    .from('next_session_suggestions')
    .update({
      consumed_at: new Date().toISOString(),
      consumed_decision: decision,
    } as never)
    .eq('id', suggestionId);
  if (error) throw toAppError(error);
}
