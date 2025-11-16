/**
 * React Query hook for fetching world statistics
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, type StatsResponse } from '@3d-neighborhood/shared';

export interface UseStatsOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Fetch world statistics (total websites, chunks, etc.)
 *
 * @example
 * const { data, isLoading, error } = useStats();
 *
 * // With auto-refetch
 * const { data } = useStats({ refetchInterval: 5000 });
 */
export function useStats(options?: UseStatsOptions) {
  const { enabled = true, refetchInterval } = options || {};

  return useQuery<StatsResponse, Error>({
    queryKey: ['stats'],
    queryFn: () => apiClient.getStats(),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval,
  });
}
