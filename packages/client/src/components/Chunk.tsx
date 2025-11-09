import type { ChunkResponse } from '@3d-neighborhood/shared/api';
import { Building } from './Building';

interface ChunkProps {
  chunk: ChunkResponse;
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
