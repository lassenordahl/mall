import type { BuildingData } from '@3d-neighborhood/shared';
import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

interface BillboardData {
  id: number;
  buildingUrl: string;
  face: 'north' | 'south' | 'east' | 'west' | 'top';
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  imageUrl: string | null;
  ownerUserId: number | null;
  purchasedAt: string | null;
  expiresAt: string | null;
}

interface BillboardProps {
  building: BuildingData;
  billboard: BillboardData;
}

/**
 * Calculate world position and rotation for a billboard based on building and billboard data
 */
function calculateBillboardTransform(
  building: BuildingData,
  billboard: BillboardData
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
          worldZ - halfWidth - 0.1, // Offset slightly to avoid z-fighting
        ],
        rotation: [0, 0, 0], // Face toward +Z
      };
    case 'south': // +Z face
      return {
        position: [
          worldX + (positionX - 0.5) * width,
          baseY + positionY * height,
          worldZ + halfWidth + 0.1,
        ],
        rotation: [0, Math.PI, 0], // Face toward -Z
      };
    case 'east': // +X face
      return {
        position: [
          worldX + halfWidth + 0.1,
          baseY + positionY * height,
          worldZ + (positionX - 0.5) * width,
        ],
        rotation: [0, -Math.PI / 2, 0], // Face toward -X
      };
    case 'west': // -X face
      return {
        position: [
          worldX - halfWidth - 0.1,
          baseY + positionY * height,
          worldZ + (positionX - 0.5) * width,
        ],
        rotation: [0, Math.PI / 2, 0], // Face toward +X
      };
    default:
    case 'top': // +Y face (roof)
      return {
        position: [
          worldX + (positionX - 0.5) * width,
          baseY + height + 0.1,
          worldZ + (positionY - 0.5) * width,
        ],
        rotation: [-Math.PI / 2, 0, 0], // Face upward
      };
  }
}

/**
 * Billboard component - renders an image on a building face
 * Only renders if the billboard has been purchased (imageUrl is not null)
 *
 * Renders as a 3D panel:
 * - Black backing panel (0.2 units thick)
 * - Image texture on front face, floating away from building
 */
export function Billboard({ building, billboard }: BillboardProps) {
  // Don't render if billboard hasn't been purchased
  if (!billboard.imageUrl) {
    return null;
  }

  // MUST call hooks before any early returns or conditionals
  const texture = useTexture(billboard.imageUrl);

  // Calculate billboard size: 80% of building width
  const billboardWidth = building.width * 0.8;
  const billboardHeight = billboardWidth * 0.75; // 4:3 aspect ratio

  const { position, rotation } = useMemo(
    () => calculateBillboardTransform(building, billboard),
    [building, billboard]
  );

  const PANEL_DEPTH = 0.2;
  const OFFSET_FROM_WALL = 0.5; // Float away from wall to prevent z-fighting

  // Adjust position to offset from wall - move AWAY from building center
  const offsetPosition = useMemo(() => {
    const [x, y, z] = position;
    const [, ry] = rotation;

    // Calculate normal direction based on face rotation
    // We need to move in the direction the billboard is FACING (away from wall)
    // North face (-Z wall) = faces +Z (towards viewer from north)
    // South face (+Z wall) = faces -Z (towards viewer from south)
    // East face (+X wall) = faces -X (towards viewer from east)
    // West face (-X wall) = faces +X (towards viewer from west)
    let offsetX = 0, offsetZ = 0;

    if (Math.abs(ry) < 0.1) { // North face (-Z wall, faces +Z)
      offsetZ -= OFFSET_FROM_WALL; // Move towards -Z (away from building)
    } else if (Math.abs(ry - Math.PI) < 0.1) { // South face (+Z wall, faces -Z)
      offsetZ += OFFSET_FROM_WALL; // Move towards +Z (away from building)
    } else if (Math.abs(ry + Math.PI / 2) < 0.1) { // East face (+X wall, faces -X)
      offsetX += OFFSET_FROM_WALL; // Move towards +X (away from building)
    } else if (Math.abs(ry - Math.PI / 2) < 0.1) { // West face (-X wall, faces +X)
      offsetX -= OFFSET_FROM_WALL; // Move towards -X (away from building)
    }
    // Top face doesn't need horizontal offset

    return [x + offsetX, y, z + offsetZ] as [number, number, number];
  }, [position, rotation]);

  return (
    <group position={offsetPosition} rotation={rotation}>
      {/* Black backing panel (behind the image) */}
      <mesh position={[0, 0, PANEL_DEPTH / 2]}>
        <boxGeometry args={[billboardWidth, billboardHeight, PANEL_DEPTH]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Image on front face (toward viewer) */}
      <mesh position={[0, 0, -PANEL_DEPTH / 2 - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[billboardWidth, billboardHeight]} />
        <meshBasicMaterial
          map={texture}
          transparent={true}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
