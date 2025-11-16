/**
 * React Query hook for searching websites
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, type SearchWebsitesResponse } from '@3d-neighborhood/shared';

export interface UseSearchWebsitesOptions {
  query: string;
  enabled?: boolean;
}

/**
 * Search websites by query string with automatic debouncing via query keys
 *
 * @example
 * const { data, isLoading, error } = useSearchWebsites({ query: 'google' });
 */
export function useSearchWebsites({ query, enabled = true }: UseSearchWebsitesOptions) {
  return useQuery<SearchWebsitesResponse, Error>({
    queryKey: ['websites', 'search', query],
    queryFn: () => apiClient.searchWebsites(query),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
  });
}
