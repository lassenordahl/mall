import { useMemo } from 'react';
import { generateChunk, DEFAULT_WORLD_CONFIG } from '@3d-neighborhood/shared';
import type { ChunkData } from '@3d-neighborhood/shared';

/**
 * Hook to generate chunks client-side (Phase 1)
 *
 * Later (Phase 3): This will fetch from API instead of generating locally
 *
 * @returns Array of ChunkData for 3x3 grid around origin
 */
export function useChunks(): ChunkData[] {
  const chunks = useMemo(() => {
    const result: ChunkData[] = [];

    // Generate 3x3 grid of chunks (cx/cz: -1 to 1)
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        result.push(generateChunk(cx, cz, DEFAULT_WORLD_CONFIG));
      }
    }

    return result;
  }, []);

  return chunks;
}
