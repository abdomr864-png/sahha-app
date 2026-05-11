import { useQuery } from '@tanstack/react-query';
import { listExercises } from '../repositories/exercises';
import type { ExerciseFilter } from '../schemas';

export function useExerciseLibrary(filter: ExerciseFilter) {
  return useQuery({
    queryKey: ['exercises', filter],
    queryFn: () => listExercises(filter),
    staleTime: 5 * 60_000,
  });
}
