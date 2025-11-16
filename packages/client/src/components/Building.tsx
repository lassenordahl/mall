import type { BuildingData } from '@3d-neighborhood/shared';
import { DEFAULT_WORLD_CONFIG, BuildingType } from '@3d-neighborhood/shared';
import { useMemo } from 'react';
import * as THREE from 'three';
import { Billboard } from './Billboard';
import { GhostBillboard } from './GhostBillboard';

interface BuildingProps {
  building: BuildingData;
  type?: BuildingType;
  ghostBillboard?: {
    face: 'north' | 'south' | 'east' | 'west' | 'top';
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  } | null;
}

/**
 * Individual building component
 * Renders with white walls and colored edges based on type
 *
 * Position: worldX/worldZ from generation
 * Size: width x height from generation
 * Style: White walls with edges colored by BuildingType
 *   - NORMAL: Black edges
 *   - NEW: Green edges (newly generated this session)
 *   - ANCHOR: Blue edges (future)
 *   - HIGHLIGHTED: Yellow edges (future)
 */
export function Building({ building, type = BuildingType.NORMAL, ghostBillboard }: BuildingProps) {
  // Position at worldX/worldZ, with building centered on ground (y = height/2)
  const x = building.worldX;
  const y = building.height / 2;
  const z = building.worldZ;

  // Determine edge color based on building type
  const edgeColor = useMemo(() => {
    switch (type) {
      case BuildingType.NEW:
        return '#00ff00'; // Green for new buildings
      case BuildingType.ANCHOR:
        return '#0088ff'; // Blue for anchors (future)
      case BuildingType.HIGHLIGHTED:
        return '#ffff00'; // Yellow for highlighted (future)
      case BuildingType.NORMAL:
      default:
        return '#000000'; // Black for normal
    }
  }, [type]);

  // Create edges geometry for clean colored lines
  const edgesGeometry = useMemo(() => {
    const boxGeometry = new THREE.BoxGeometry(
      building.width,
      building.height,
      building.width
    );
    return new THREE.EdgesGeometry(boxGeometry);
  }, [building.width, building.height]);

  return (
    <>
      <group position={[x, y, z]}>
        {/* White walls */}
        <mesh>
          <boxGeometry args={[building.width, building.height, building.width]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Colored wireframe edges based on type */}
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial
            color={edgeColor}
            linewidth={DEFAULT_WORLD_CONFIG.wireframeLineWidth}
          />
        </lineSegments>
      </group>

      {/* Render billboard if purchased */}
      {(building as any).billboard && <Billboard building={building} billboard={(building as any).billboard} />}

      {/* Render ghost billboard preview if hovering in billboard mode */}
      {ghostBillboard && (
        <GhostBillboard
          building={building}
          face={ghostBillboard.face}
          positionX={ghostBillboard.positionX}
          positionY={ghostBillboard.positionY}
        />
      )}
    </>
  );
}
