import type { ChunkResponse } from '@3d-neighborhood/shared/api';
import { Building } from './Building';
import { BuildingType } from '@3d-neighborhood/shared';

interface ChunkProps {
  chunk: ChunkResponse;
  isNew?: boolean; // Whether this chunk was newly generated this session
}

/**
 * Renders all buildings in a chunk
 */
export function Chunk({ chunk, isNew = false }: ChunkProps) {
  const buildingType = isNew ? BuildingType.NEW : BuildingType.NORMAL;

  return (
    <>
      {chunk.buildings.map((building, index) => (
        <Building
          key={`${chunk.chunkX}-${chunk.chunkZ}-${index}`}
          building={building}
          type={buildingType}
        />
      ))}
    </>
  );
}
