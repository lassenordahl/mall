import type { BuildingData } from '@3d-neighborhood/shared';
import { DEFAULT_WORLD_CONFIG } from '@3d-neighborhood/shared';
import { useMemo } from 'react';
import * as THREE from 'three';

interface BuildingProps {
  building: BuildingData;
}

/**
 * Individual building component
 * Renders with white walls and black edges (liminal aesthetic)
 *
 * Position: worldX/worldZ from generation
 * Size: width x height from generation
 * Style: White walls with black edges
 */
export function Building({ building }: BuildingProps) {
  // Position at worldX/worldZ, with building centered on ground (y = height/2)
  const x = building.worldX;
  const y = building.height / 2;
  const z = building.worldZ;

  // Create edges geometry for clean black lines
  const edgesGeometry = useMemo(() => {
    const boxGeometry = new THREE.BoxGeometry(
      building.width,
      building.height,
      building.width
    );
    return new THREE.EdgesGeometry(boxGeometry);
  }, [building.width, building.height]);

  return (
    <group position={[x, y, z]}>
      {/* White walls */}
      <mesh>
        <boxGeometry args={[building.width, building.height, building.width]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Black wireframe edges */}
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial
          color="#000000"
          linewidth={DEFAULT_WORLD_CONFIG.wireframeLineWidth}
        />
      </lineSegments>
    </group>
  );
}
