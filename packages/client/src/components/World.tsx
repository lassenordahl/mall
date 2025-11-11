import { useChunks } from '../hooks/useChunks';
import { Chunk } from './Chunk';
import type { BuildingData } from '@3d-neighborhood/shared';

interface WorldProps {
  onBuildingsLoaded?: (buildings: BuildingData[]) => void;
  spawnPosition?: [number, number, number];
}

/**
 * World component - manages all chunks
 * Fetches chunks from API based on player spawn position
 */
export function World({ onBuildingsLoaded, spawnPosition }: WorldProps) {
  console.log('[World] Rendering with spawn position:', spawnPosition);
  const chunks = useChunks(spawnPosition);

  // Collect all buildings from all chunks
  const allBuildings = chunks.flatMap(chunk => chunk.buildings);

  // Notify parent of buildings (for collision detection)
  if (onBuildingsLoaded && allBuildings.length > 0) {
    onBuildingsLoaded(allBuildings);
  }

  console.log(`[World] Rendering ${chunks.length} chunks with ${allBuildings.length} total buildings`);

  return (
    <>
      {chunks.map((chunk) => (
        <Chunk key={`${chunk.chunkX}-${chunk.chunkZ}`} chunk={chunk} />
      ))}
    </>
  );
}
