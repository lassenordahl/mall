import type { ChunkResponse } from '@3d-neighborhood/shared/api';
import { Building } from './Building';
import { BuildingType } from '@3d-neighborhood/shared';

interface ChunkProps {
  chunk: ChunkResponse;
  isNew?: boolean; // Whether this chunk was newly generated this session
  ghostBillboard?: {
    building: any; // BuildingData type
    face: 'north' | 'south' | 'east' | 'west' | 'top';
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  } | null;
}

/**
 * Renders all buildings in a chunk
 */
export function Chunk({ chunk, isNew = false, ghostBillboard }: ChunkProps) {
  const buildingType = isNew ? BuildingType.NEW : BuildingType.NORMAL;

  return (
    <>
      {chunk.buildings.map((building, index) => {
        // Check if this building is the ghost billboard target
        const isGhostTarget = ghostBillboard && ghostBillboard.building.url === building.url;

        return (
          <Building
            key={`${chunk.chunkX}-${chunk.chunkZ}-${index}`}
            building={building}
            type={buildingType}
            ghostBillboard={
              isGhostTarget
                ? {
                    face: ghostBillboard.face,
                    positionX: ghostBillboard.positionX,
                    positionY: ghostBillboard.positionY,
                    width: ghostBillboard.width,
                    height: ghostBillboard.height,
                  }
                : null
            }
          />
        );
      })}
    </>
  );
}
