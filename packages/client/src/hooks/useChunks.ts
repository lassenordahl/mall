import { useState, useEffect } from 'react';
import { fetchChunk } from '@3d-neighborhood/shared/api';
import type { ChunkResponse } from '@3d-neighborhood/shared/api';

/**
 * Hook to fetch chunks from API (Phase 3)
 *
 * @returns Array of ChunkResponse for 3x3 grid around origin
 */
export function useChunks(): ChunkResponse[] {
  const [chunks, setChunks] = useState<ChunkResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChunks = async () => {
      try {
        setLoading(true);
        const result: ChunkResponse[] = [];

        // Fetch 3x3 grid of chunks (cx/cz: -1 to 1)
        for (let cx = -1; cx <= 1; cx++) {
          for (let cz = -1; cz <= 1; cz++) {
            const chunk = await fetchChunk(cx, cz);
            result.push(chunk);
          }
        }

        setChunks(result);
        setError(null);
      } catch (err) {
        console.error('Failed to load chunks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chunks');
      } finally {
        setLoading(false);
      }
    };

    loadChunks();
  }, []);

  return chunks;
}
