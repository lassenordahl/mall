import type { ChunkData } from '@3d-neighborhood/shared';
import { Building } from './Building';

interface ChunkProps {
  chunk: ChunkData;
}

/**
 * Renders all buildings in a chunk
 */
export function Chunk({ chunk }: ChunkProps) {
  return (
    <>
      {chunk.buildings.map((building, index) => (
        <Building key={`${chunk.chunkX}-${chunk.chunkZ}-${index}`} building={building} />
      ))}
    </>
  );
}
