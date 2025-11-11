import { useState, useEffect } from 'react';
import { fetchChunk } from '@3d-neighborhood/shared/api';
import type { ChunkResponse } from '@3d-neighborhood/shared/api';

// Chunk system constants (must match server-side)
const CHUNK_GRID_SIZE = 5;  // 5x5 cells per chunk
const CELL_SIZE = 30;        // 30 units per cell
const CHUNK_SIZE = CHUNK_GRID_SIZE * CELL_SIZE; // 150 units per chunk

/**
 * Convert world coordinates to chunk coordinates
 */
function worldToChunk(worldX: number, worldZ: number): { chunkX: number; chunkZ: number } {
  // Floor division to get chunk coordinates
  // Negative coordinates need special handling due to JS floor behavior
  const chunkX = Math.floor(worldX / CHUNK_SIZE);
  const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
  return { chunkX, chunkZ };
}

/**
 * Hook to fetch chunks from API based on player position
 *
 * @param spawnPosition - Initial spawn position [x, y, z] in world coordinates
 * @returns Array of ChunkResponse for 3x3 grid around spawn position
 */
export function useChunks(spawnPosition?: [number, number, number]): ChunkResponse[] {
  const [chunks, setChunks] = useState<ChunkResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChunks = async () => {
      try {
        setLoading(true);
        const result: ChunkResponse[] = [];

        // Determine center chunk based on spawn position
        let centerChunkX = 0;
        let centerChunkZ = 0;

        if (spawnPosition) {
          const [worldX, , worldZ] = spawnPosition;
          const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
          centerChunkX = chunkX;
          centerChunkZ = chunkZ;
          console.log(`[useChunks] Spawn at world coords (${worldX}, ${worldZ}) -> chunk (${chunkX}, ${chunkZ})`);
        } else {
          console.log(`[useChunks] No spawn position provided, using origin chunk (0, 0)`);
        }

        console.log(`[useChunks] Loading 3x3 grid of chunks centered at chunk (${centerChunkX}, ${centerChunkZ})`);

        // Fetch 3x3 grid of chunks around center chunk
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const cx = centerChunkX + dx;
            const cz = centerChunkZ + dz;
            console.log(`[useChunks] Fetching chunk (${cx}, ${cz})...`);
            const chunk = await fetchChunk(cx, cz);
            console.log(`[useChunks] Loaded chunk (${cx}, ${cz}) with ${chunk.buildings.length} buildings`);
            result.push(chunk);
          }
        }

        console.log(`[useChunks] Loaded ${result.length} chunks total`);
        setChunks(result);
        setError(null);
      } catch (err) {
        console.error('[useChunks] Failed to load chunks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chunks');
      } finally {
        setLoading(false);
      }
    };

    loadChunks();
  }, [spawnPosition?.[0], spawnPosition?.[2]]); // Only re-run if X or Z changes

  return chunks;
}
