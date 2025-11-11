import { useState, useEffect, useRef } from 'react';
import { fetchChunk } from '@3d-neighborhood/shared/api';
import type { ChunkResponse, ChunkWithMetadata } from '@3d-neighborhood/shared/api';
import type { PlayerPosition } from './usePlayerPosition';

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
 * Hook to fetch chunks from API with dynamic loading based on player position
 *
 * @param spawnPosition - Initial spawn position [x, y, z] in world coordinates
 * @param onChunkLoaded - Callback when chunk is loaded with cache status
 * @param playerPosition - Current player position (drives dynamic loading)
 * @returns Array of ChunkResponse for chunks around player
 */
export function useChunks(
  spawnPosition?: [number, number, number],
  onChunkLoaded?: (chunkX: number, chunkZ: number, cacheStatus: 'hit' | 'miss') => void,
  playerPosition?: PlayerPosition
): ChunkResponse[] {
  const [chunkMap, setChunkMap] = useState<Map<string, ChunkResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedChunks = useRef<Set<string>>(new Set());
  const isLoadingChunk = useRef<Set<string>>(new Set());

  // Helper to get chunk key
  const getChunkKey = (cx: number, cz: number) => `${cx},${cz}`;

  // Helper to load a single chunk
  const loadChunk = async (cx: number, cz: number) => {
    const key = getChunkKey(cx, cz);

    // Skip if already loaded or currently loading
    if (loadedChunks.current.has(key) || isLoadingChunk.current.has(key)) {
      return;
    }

    isLoadingChunk.current.add(key);

    try {
      console.log(`[useChunks] Fetching chunk (${cx}, ${cz})...`);
      const { chunk, cacheStatus } = await fetchChunk(cx, cz);
      console.log(`[useChunks] Loaded chunk (${cx}, ${cz}) with ${chunk.buildings.length} buildings [${cacheStatus.toUpperCase()}]`);

      // Add to loaded set
      loadedChunks.current.add(key);

      // Update chunk map
      setChunkMap(prev => {
        const next = new Map(prev);
        next.set(key, chunk);
        return next;
      });

      // Notify callback
      onChunkLoaded?.(cx, cz, cacheStatus);
    } catch (err) {
      console.error(`[useChunks] Failed to load chunk (${cx}, ${cz}):`, err);
    } finally {
      isLoadingChunk.current.delete(key);
    }
  };

  // Initial load around spawn position
  useEffect(() => {
    const loadInitialChunks = async () => {
      setLoading(true);

      // Determine center chunk based on spawn position
      let centerChunkX = 0;
      let centerChunkZ = 0;

      if (spawnPosition) {
        const [worldX, , worldZ] = spawnPosition;
        const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);
        centerChunkX = chunkX;
        centerChunkZ = chunkZ;
        console.log(`[useChunks] Initial load at world coords (${worldX}, ${worldZ}) -> chunk (${chunkX}, ${chunkZ})`);
      } else {
        console.log(`[useChunks] No spawn position, using origin chunk (0, 0)`);
      }

      console.log(`[useChunks] Loading 3x3 grid centered at chunk (${centerChunkX}, ${centerChunkZ})`);

      // Load 3x3 grid around spawn
      const promises = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          promises.push(loadChunk(centerChunkX + dx, centerChunkZ + dz));
        }
      }

      await Promise.all(promises);
      setLoading(false);
    };

    loadInitialChunks();
  }, [spawnPosition?.[0], spawnPosition?.[2]]);

  // Dynamic loading based on player position
  useEffect(() => {
    if (!playerPosition) return;

    const { chunkX, chunkZ } = playerPosition;

    console.log(`[useChunks] Player in chunk (${chunkX}, ${chunkZ}), checking for new chunks to load...`);

    // Load 3x3 around player (async, don't block)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        loadChunk(chunkX + dx, chunkZ + dz);
      }
    }

    // TODO: Unload chunks far from player (memory management)
    // For now, we keep all chunks loaded
  }, [playerPosition?.chunkX, playerPosition?.chunkZ]);

  // Convert map to array
  return Array.from(chunkMap.values());
}
