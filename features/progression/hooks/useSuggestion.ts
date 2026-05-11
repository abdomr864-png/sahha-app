import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSuggestionForExercise, markSuggestion } from '../repositories/suggestions';
import type { NextSessionSuggestion } from '../schemas';

const KEY = (exerciseId: string) => ['progression', 'suggestion', exerciseId] as const;

export function useExerciseSuggestion(exerciseId: string | null | undefined) {
  return useQuery<NextSessionSuggestion | null>({
    queryKey: KEY(exerciseId ?? ''),
    enabled: !!exerciseId,
    staleTime: 60_000,
    queryFn: () => (exerciseId ? fetchSuggestionForExercise(exerciseId) : Promise.resolve(null)),
  });
}

export function useResolveSuggestion(exerciseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'accepted' | 'declined' }) =>
      markSuggestion(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(exerciseId) });
    },
  });
}
