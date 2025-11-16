/**
 * React Query hook for getting website entry points
 */
import { useMutation } from '@tanstack/react-query';
import { apiClient, type EntryPointResponse } from '@3d-neighborhood/shared';

/**
 * Get entry point (spawn location) for a specific website
 * Uses mutation since it's a POST request that may generate new chunks
 *
 * @example
 * const { mutate, data, isPending, error } = useEntryPoint();
 * mutate('google.com');
 */
export function useEntryPoint() {
  return useMutation<EntryPointResponse, Error, string>({
    mutationFn: (url: string) => apiClient.getEntryPoint(url),
  });
}
