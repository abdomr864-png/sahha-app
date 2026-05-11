import { useQuery } from '@tanstack/react-query';
import { getExerciseById } from '../repositories/exerciseDetail';

export function useExerciseDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['exercise', id],
    enabled: !!id,
    queryFn: () => getExerciseById(id!),
    staleTime: 10 * 60_000,
  });
}
