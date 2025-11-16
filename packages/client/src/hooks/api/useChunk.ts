/**
 * React Query hook for fetching chunks
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient, type ChunkWithMetadata } from '@3d-neighborhood/shared';

export interface UseChunkOptions {
  chunkX: number;
  chunkZ: number;
  enabled?: boolean;
}

/**
 * Fetch a single chunk by coordinates
 *
 * @example
 * const { data, isLoading, error } = useChunk({ chunkX: 0, chunkZ: 0 });
 */
export function useChunk({ chunkX, chunkZ, enabled = true }: UseChunkOptions) {
  return useQuery<ChunkWithMetadata, Error>({
    queryKey: ['chunks', chunkX, chunkZ],
    queryFn: () => apiClient.getChunk(chunkX, chunkZ),
    enabled,
    staleTime: Infinity, // Chunks never change (immutable by world version)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}
