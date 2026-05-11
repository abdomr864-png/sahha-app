import { useQuery } from '@tanstack/react-query';
import { listSavedEquipment } from '../repositories/scans';

export function useSavedEquipment(userId: string | undefined) {
  return useQuery({
    queryKey: ['saved-equipment', userId],
    enabled: !!userId,
    queryFn: () => listSavedEquipment(userId!),
    staleTime: 60_000,
  });
}
