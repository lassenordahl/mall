import { useChunks } from '../hooks/useChunks';
import { Chunk } from './Chunk';
import type { BuildingData } from '@3d-neighborhood/shared';

interface WorldProps {
  onBuildingsLoaded?: (buildings: BuildingData[]) => void;
}

/**
 * World component - manages all chunks
 * Currently generates 3x3 chunks client-side
 * Later (Phase 3): Will fetch chunks from API based on player position
 */
export function World({ onBuildingsLoaded }: WorldProps) {
  const chunks = useChunks();

  // Collect all buildings from all chunks
  const allBuildings = chunks.flatMap(chunk => chunk.buildings);

  // Notify parent of buildings (for collision detection)
  if (onBuildingsLoaded && allBuildings.length > 0) {
    onBuildingsLoaded(allBuildings);
  }

  return (
    <>
      {chunks.map((chunk) => (
        <Chunk key={`${chunk.chunkX}-${chunk.chunkZ}`} chunk={chunk} />
      ))}
    </>
  );
}
