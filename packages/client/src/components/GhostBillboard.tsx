import type { BuildingData } from '@3d-neighborhood/shared';
import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

interface GhostBillboardProps {
  building: BuildingData;
  face: 'north' | 'south' | 'east' | 'west' | 'top';
  positionX: number; // 0.0-1.0
  positionY: number; // 0.0-1.0
}

/**
 * Calculate world position and rotation for a billboard based on building and billboard data
 */
function calculateBillboardTransform(
  building: BuildingData,
  billboard: {
    face: 'north' | 'south' | 'east' | 'west' | 'top';
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  }
): {
  position: [number, number, number];
  rotation: [number, number, number];
} {
  const { worldX, worldZ, width, height } = building;
  const { face, positionX, positionY } = billboard;

  const baseY = 0; // Ground level
  const halfWidth = width / 2;

  switch (face) {
    case 'north': // -Z face
      return {
        position: [
          worldX + (positionX - 0.5) * width,
          baseY + positionY * height,
          worldZ - halfWidth - 0.1,
        ],
        rotation: [0, 0, 0],
      };
    case 'south': // +Z face
      return {
        position: [
          worldX + (positionX - 0.5) * width,
          baseY + positionY * height,
          worldZ + halfWidth + 0.1,
        ],
        rotation: [0, Math.PI, 0],
      };
    case 'east': // +X face
      return {
        position: [
          worldX + halfWidth + 0.1,
          baseY + positionY * height,
          worldZ + (positionX - 0.5) * width,
        ],
        rotation: [0, -Math.PI / 2, 0],
      };
    case 'west': // -X face
      return {
        position: [
          worldX - halfWidth - 0.1,
          baseY + positionY * height,
          worldZ + (positionX - 0.5) * width,
        ],
        rotation: [0, Math.PI / 2, 0],
      };
    case 'top': // +Y face (roof)
      return {
        position: [
          worldX + (positionX - 0.5) * width,
          baseY + height + 0.1,
          worldZ + (positionY - 0.5) * width,
        ],
        rotation: [-Math.PI / 2, 0, 0],
      };
  }
}

/**
 * Ghost billboard component - semi-transparent preview for billboard placement
 * Shows where billboard will be placed in real-time
 */
export function GhostBillboard({
  building,
  face,
  positionX,
  positionY,
}: GhostBillboardProps) {
  // Load test SVG image
  const texture = useTexture('/billboards/test.svg');

  // Calculate billboard size: 80% of building width (matching actual billboards)
  const billboardWidth = building.width * 0.8;
  const billboardHeight = billboardWidth * 0.75; // 4:3 aspect ratio

  const { position, rotation } = useMemo(
    () =>
      calculateBillboardTransform(building, {
        face,
        positionX,
        positionY,
        width: billboardWidth,
        height: billboardHeight,
      }),
    [building, face, positionX, positionY, billboardWidth, billboardHeight]
  );

  const PANEL_DEPTH = 0.2;
  const OFFSET_FROM_WALL = 0.5;

  // Adjust position to offset from wall - move AWAY from building center
  const offsetPosition = useMemo(() => {
    const [x, y, z] = position;
    const [, ry] = rotation;

    let offsetX = 0,
      offsetZ = 0;

    if (Math.abs(ry) < 0.1) {
      // North face
      offsetZ -= OFFSET_FROM_WALL;
    } else if (Math.abs(ry - Math.PI) < 0.1) {
      // South face
      offsetZ += OFFSET_FROM_WALL;
    } else if (Math.abs(ry + Math.PI / 2) < 0.1) {
      // East face
      offsetX += OFFSET_FROM_WALL;
    } else if (Math.abs(ry - Math.PI / 2) < 0.1) {
      // West face
      offsetX -= OFFSET_FROM_WALL;
    }

    return [x + offsetX, y, z + offsetZ] as [number, number, number];
  }, [position, rotation]);

  return (
    <group position={offsetPosition} rotation={rotation}>
      {/* Semi-transparent gray backing panel */}
      <mesh position={[0, 0, PANEL_DEPTH / 2]}>
        <boxGeometry args={[billboardWidth, billboardHeight, PANEL_DEPTH]} />
        <meshBasicMaterial color="#555555" transparent={true} opacity={0.5} />
      </mesh>

      {/* Test image on front face (semi-transparent) */}
      <mesh position={[0, 0, -PANEL_DEPTH / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[billboardWidth, billboardHeight]} />
        <meshBasicMaterial
          map={texture}
          transparent={true}
          opacity={0.6}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
