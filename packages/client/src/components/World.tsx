import { useChunks } from '../hooks/useChunks';
import { useNewChunks } from '../hooks/useNewChunks';
import { Chunk } from './Chunk';
import type { BuildingData } from '@3d-neighborhood/shared';
import type { PlayerPosition } from '../hooks/usePlayerPosition';
import { useCallback } from 'react';

interface WorldProps {
  onBuildingsLoaded?: (buildings: BuildingData[]) => void;
  spawnPosition?: [number, number, number];
  onNewChunksChange?: (newChunkCount: number, newChunkKeys: string[]) => void;
  playerPosition?: PlayerPosition;
}

/**
 * World component - manages all chunks
 * Fetches chunks from API based on player spawn position
 */
export function World({ onBuildingsLoaded, spawnPosition, onNewChunksChange, playerPosition }: WorldProps) {
  console.log('[World] Rendering with spawn position:', spawnPosition);

  // Track new chunks
  const { markAsNew, isNew, getNewChunkCount, newChunkKeys } = useNewChunks();

  // Handle chunk loaded callback
  const handleChunkLoaded = useCallback((chunkX: number, chunkZ: number, cacheStatus: 'hit' | 'miss') => {
    if (cacheStatus === 'miss') {
      markAsNew(chunkX, chunkZ);
      // Callback with updated count and keys
      const newCount = getNewChunkCount() + 1;
      const newKeys = [...newChunkKeys, `${chunkX},${chunkZ}`];
      onNewChunksChange?.(newCount, newKeys);
    }
  }, [markAsNew, getNewChunkCount, newChunkKeys, onNewChunksChange]);

  const chunks = useChunks(spawnPosition, handleChunkLoaded, playerPosition);

  // Collect all buildings from all chunks
  const allBuildings = chunks.flatMap(chunk => chunk.buildings);

  // Notify parent of buildings (for collision detection)
  if (onBuildingsLoaded && allBuildings.length > 0) {
    onBuildingsLoaded(allBuildings);
  }

  console.log(`[World] Rendering ${chunks.length} chunks with ${allBuildings.length} total buildings`);

  return (
    <>
      {chunks.map((chunk) => {
        const chunkIsNew = isNew(chunk.chunkX, chunk.chunkZ);
        return (
          <Chunk
            key={`${chunk.chunkX}-${chunk.chunkZ}`}
            chunk={chunk}
            isNew={chunkIsNew}
          />
        );
      })}
    </>
  );
}
