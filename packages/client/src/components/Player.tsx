import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingData } from '@3d-neighborhood/shared';

interface SpawnPoint {
  position: [number, number, number];
  lookAt: [number, number, number];
}

interface PlayerProps {
  buildings: BuildingData[];
  onTargetChange?: (building: BuildingData | null) => void;
  spawnPoint?: SpawnPoint;
  noclip?: boolean;
  onPositionChange?: (x: number, y: number, z: number) => void;
  onRotationChange?: (yaw: number) => void;
  billboardMode?: boolean;
  onBillboardModeChange?: (mode: boolean) => void;
  onGhostBillboardChange?: (billboard: {
    building: BuildingData;
    face: 'north' | 'south' | 'east' | 'west' | 'top';
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  } | null) => void;
}

/**
 * Player controller with WASD movement and mouse look
 *
 * Click to lock pointer, then use:
 * - WASD to move
 * - Mouse to look around
 * - ESC to unlock pointer
 *
 * Includes collision detection with buildings
 */
export function Player({ buildings, onTargetChange, spawnPoint, noclip = false, onPositionChange, onRotationChange, billboardMode = false, onBillboardModeChange, onGhostBillboardChange }: PlayerProps) {
  const { camera, scene } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const lastCollisionAlert = useRef<number>(0); // Throttle collision alerts
  const hasSetSpawnPosition = useRef(false);
  const raycaster = useRef(new THREE.Raycaster());
  const lastTargetBuilding = useRef<BuildingData | null>(null);
  const lastRaycastTime = useRef(0);
  const RAYCAST_INTERVAL = 150; // Only raycast every 150ms instead of every frame

  // Billboard mode state
  const ghostBillboardRef = useRef<{
    building: BuildingData;
    face: 'north' | 'south' | 'east' | 'west' | 'top';
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  } | null>(null);
  const GRID_SNAP = 0.1; // Snap to 10% increments

  // Set spawn position and camera orientation
  if (!hasSetSpawnPosition.current) {
    if (spawnPoint) {
      // Use provided spawn point
      camera.position.set(...spawnPoint.position);
      camera.lookAt(new THREE.Vector3(...spawnPoint.lookAt));
      hasSetSpawnPosition.current = true;
      console.log(`[Player] Spawned at: (${spawnPoint.position.join(', ')})`);
      console.log(`[Player] Looking at: (${spawnPoint.lookAt.join(', ')})`);
      console.log(`[Player] Available buildings: ${buildings.length}`);
      if (buildings.length > 0) {
        const nearestBuilding = buildings.reduce((nearest, b) => {
          const distToB = Math.hypot(b.worldX - spawnPoint.position[0], b.worldZ - spawnPoint.position[2]);
          const distToNearest = nearest ? Math.hypot(nearest.worldX - spawnPoint.position[0], nearest.worldZ - spawnPoint.position[2]) : Infinity;
          return distToB < distToNearest ? b : nearest;
        }, buildings[0]);
        const distToNearest = Math.hypot(nearestBuilding.worldX - spawnPoint.position[0], nearestBuilding.worldZ - spawnPoint.position[2]);
        console.log(`[Player] Nearest building: ${nearestBuilding.url} at distance ${distToNearest.toFixed(1)} units`);
      }
    } else if (buildings.length > 0) {
      // Fallback to safe spawn position
      const safePos = findSafeSpawnPosition(buildings);
      camera.position.set(safePos[0], safePos[1], safePos[2]);
      hasSetSpawnPosition.current = true;
      console.log(`[Player] Spawned at safe position: (${safePos[0]}, ${safePos[1]}, ${safePos[2]})`);
    }
  }

  /**
   * Find a safe spawn position that doesn't collide with any buildings
   */
  function findSafeSpawnPosition(buildings: BuildingData[]): [number, number, number] {
    const playerRadius = 3;

    // Try many more positions in a grid pattern
    const testPositions: [number, number, number][] = [];
    for (let x = -100; x <= 100; x += 20) {
      for (let z = -100; z <= 100; z += 20) {
        testPositions.push([x, 1.6, z]);
      }
    }

    for (const [x, y, z] of testPositions) {
      let collides = false;

      for (const building of buildings) {
        const halfWidth = building.width / 2;
        const minX = building.worldX - halfWidth;
        const maxX = building.worldX + halfWidth;
        const minZ = building.worldZ - halfWidth;
        const maxZ = building.worldZ + halfWidth;

        const closestX = Math.max(minX, Math.min(x, maxX));
        const closestZ = Math.max(minZ, Math.min(z, maxZ));

        const distanceX = x - closestX;
        const distanceZ = z - closestZ;
        const distanceSquared = distanceX * distanceX + distanceZ * distanceZ;

        if (distanceSquared < playerRadius * playerRadius) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        console.log(`Found safe spawn at: ${x}, ${z}`);
        return [x, y, z];
      }
    }

    console.warn('No safe spawn found, using fallback');
    return [200, 1.6, 200];
  }

  // Movement state
  const moveState = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  // Set up keyboard listeners
  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
        moveState.current.forward = true;
        break;
      case 'KeyS':
        moveState.current.backward = true;
        break;
      case 'KeyA':
        moveState.current.left = true;
        break;
      case 'KeyD':
        moveState.current.right = true;
        break;
      case 'KeyB':
        // Toggle billboard mode
        onBillboardModeChange?.(!billboardMode);
        // Clear ghost billboard when exiting mode
        if (billboardMode) {
          ghostBillboardRef.current = null;
        }
        break;
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'KeyW':
        moveState.current.forward = false;
        break;
      case 'KeyS':
        moveState.current.backward = false;
        break;
      case 'KeyA':
        moveState.current.left = false;
        break;
      case 'KeyD':
        moveState.current.right = false;
        break;
    }
  };

  // Add keyboard listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  /**
   * Convert 3D world position to 2D relative coordinates on a building face
   * Returns [positionX, positionY, face] where X,Y are 0.0-1.0 on the face
   */
  const convertWorldToFaceCoordinates = (
    hitPoint: THREE.Vector3,
    building: BuildingData
  ): { positionX: number; positionY: number; face: 'north' | 'south' | 'east' | 'west' | 'top' } | null => {
    const { worldX, worldZ, width, height } = building;
    const halfWidth = width / 2;
    const x = hitPoint.x;
    const y = hitPoint.y;
    const z = hitPoint.z;

    // Determine which face was hit
    const dx = Math.abs(x - worldX);
    const dz = Math.abs(z - worldZ);
    const dy = Math.abs(y - height / 2);

    let face: 'north' | 'south' | 'east' | 'west' | 'top';
    let positionX: number;
    let positionY: number;

    // Check which face is closest to hit point
    if (dy > dx && dy > dz) {
      // Top face
      face = 'top';
      positionX = (x - (worldX - halfWidth)) / width;
      positionY = (z - (worldZ - halfWidth)) / width;
    } else if (dz > dx) {
      // North or South face
      if (z < worldZ) {
        face = 'north';
        positionX = (x - (worldX - halfWidth)) / width;
      } else {
        face = 'south';
        positionX = (x - (worldX - halfWidth)) / width;
      }
      positionY = Math.max(0, Math.min(1, y / height));
    } else {
      // East or West face
      if (x > worldX) {
        face = 'east';
        positionX = (z - (worldZ - halfWidth)) / width;
      } else {
        face = 'west';
        positionX = (z - (worldZ - halfWidth)) / width;
      }
      positionY = Math.max(0, Math.min(1, y / height));
    }

    // Clamp to valid range
    positionX = Math.max(0, Math.min(1, positionX));
    positionY = Math.max(0, Math.min(1, positionY));

    // Snap to grid (0.1 increments = 10% grid)
    positionX = Math.round(positionX / GRID_SNAP) * GRID_SNAP;
    positionY = Math.round(positionY / GRID_SNAP) * GRID_SNAP;

    return { positionX, positionY, face };
  };

  /**
   * Constrain billboard position so it stays fully within face bounds [0, 1]
   * Takes into account billboard dimensions relative to face size
   */
  const constrainBillboardPosition = (
    positionX: number,
    positionY: number,
    building: BuildingData
  ): { positionX: number; positionY: number } => {
    // Billboard dimensions relative to face size
    const billboardWidth = building.width * 0.8;
    const billboardHeight = billboardWidth * 0.75;

    // Convert to relative coordinates (0.0-1.0 range)
    const relativeWidth = billboardWidth / building.width;
    const relativeHeight = billboardHeight / building.height;

    // Constrain position so billboard stays within bounds
    // Billboard edges: position ± (size/2)
    const halfWidth = relativeWidth / 2;
    const halfHeight = relativeHeight / 2;

    // Clamp to ensure billboard stays fully on face
    const constrainedX = Math.max(halfWidth, Math.min(1 - halfWidth, positionX));
    const constrainedY = Math.max(halfHeight, Math.min(1 - halfHeight, positionY));

    return { positionX: constrainedX, positionY: constrainedY };
  };

  /**
   * Check if a position collides with any building
   * Returns the building if collision detected, null otherwise
   */
  const checkCollision = (x: number, z: number, playerRadius = 3): BuildingData | null => {
    for (const building of buildings) {
      // Building AABB (axis-aligned bounding box)
      const halfWidth = building.width / 2;
      const minX = building.worldX - halfWidth;
      const maxX = building.worldX + halfWidth;
      const minZ = building.worldZ - halfWidth;
      const maxZ = building.worldZ + halfWidth;

      // Check if player circle intersects with building AABB
      // Find closest point on AABB to circle center
      const closestX = Math.max(minX, Math.min(x, maxX));
      const closestZ = Math.max(minZ, Math.min(z, maxZ));

      // Calculate distance from circle center to closest point
      const distanceX = x - closestX;
      const distanceZ = z - closestZ;
      const distanceSquared = distanceX * distanceX + distanceZ * distanceZ;

      // Check if distance is less than player radius
      if (distanceSquared < playerRadius * playerRadius) {
        return building;
      }
    }
    return null;
  };

  // Handle click to place billboard
  const onMouseClick = async () => {
    if (!billboardMode || !ghostBillboardRef.current) return;

    const { building, face, positionX, positionY, width, height } = ghostBillboardRef.current;

    // Client-side pre-validation: check if this face already has a billboard
    if ((building as any).billboard && (building as any).billboard.face === face) {
      console.warn('[Billboard Mode] Billboard already exists on this face. Cannot place.');
      return;
    }

    try {
      console.log('[Billboard Mode] Placing billboard at:', {
        buildingUrl: building.url,
        face,
        positionX,
        positionY,
        width,
        height,
      });

      // Call API to create billboard
      const response = await fetch('/api/billboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buildingUrl: building.url,
          face,
          positionX,
          positionY,
          width,
          height,
          imageUrl: '/billboards/test.svg',
        }),
      });

      const data = (await response.json()) as {
        id?: number;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        console.error('[Billboard Mode] Error:', data.error);
        return;
      }

      console.log('[Billboard Mode] Billboard created:', data);

      // TODO: Navigate to payment flow (stubbed for now)
      console.log('[Billboard Mode] Stub: Navigate to payment confirmation for billboard', data.id);
      // window.location.href = `/purchase/${data.id}`;
    } catch (error) {
      console.error('[Billboard Mode] Failed to place billboard:', error);
    }
  };

  // Add click listener for billboard placement
  if (typeof window !== 'undefined') {
    window.addEventListener('click', onMouseClick);
  }

  // Update movement each frame
  useFrame((_state, delta) => {
    const speed = 50; // units per second
    const moveSpeed = speed * delta;

    // Get camera direction
    camera.getWorldDirection(direction.current);

    // Calculate forward/backward movement
    const forward = new THREE.Vector3();
    forward.copy(direction.current).multiplyScalar(moveSpeed);
    forward.y = 0; // Keep movement horizontal

    // Calculate right/left movement (perpendicular to forward)
    const right = new THREE.Vector3();
    right.crossVectors(direction.current, camera.up).normalize().multiplyScalar(moveSpeed);

    // Apply movement based on keys pressed
    velocity.current.set(0, 0, 0);

    if (moveState.current.forward) velocity.current.add(forward);
    if (moveState.current.backward) velocity.current.sub(forward);
    if (moveState.current.right) velocity.current.add(right);
    if (moveState.current.left) velocity.current.sub(right);

    // Calculate new position
    const newPosition = camera.position.clone().add(velocity.current);

    // Check for collisions at new position (unless noclip is enabled)
    if (!noclip) {
      const collidedBuilding = checkCollision(newPosition.x, newPosition.z);

      if (collidedBuilding) {
        // Collision detected - don't move
        // TODO: Redirect to building URL
        // For now, log to console (throttled to once per second)
        const now = Date.now();
        if (now - lastCollisionAlert.current > 1000) {
          console.log(`You bumped into: ${collidedBuilding.url}`);
          lastCollisionAlert.current = now;
        }
      } else {
        // No collision - update camera position
        camera.position.add(velocity.current);
      }
    } else {
      // Noclip enabled - always move
      camera.position.add(velocity.current);
    }

    // Keep camera at eye level (1.6 units above ground)
    camera.position.y = 1.6;

    // Notify position change for chunk loading
    onPositionChange?.(camera.position.x, camera.position.y, camera.position.z);

    // Notify rotation change for minimap compass
    // Calculate yaw (horizontal rotation) from camera direction
    const yaw = Math.atan2(direction.current.x, direction.current.z);
    onRotationChange?.(yaw);

    // Real-time billboard mode raycasting (every frame)
    if (billboardMode) {
      camera.getWorldDirection(direction.current);
      raycaster.current.set(camera.position, direction.current);

      const meshes = scene.children.filter(child =>
        child.type === 'Group' || child.type === 'Mesh'
      );
      const intersects = raycaster.current.intersectObjects(meshes, true);

      // Find the first building hit
      let hitBuilding: BuildingData | null = null;
      let hitPoint: THREE.Vector3 | null = null;

      for (const intersect of intersects) {
        const meshPos = intersect.object.position;
        const parentPos = intersect.object.parent?.position;

        const actualX = parentPos ? parentPos.x : meshPos.x;
        const actualZ = parentPos ? parentPos.z : meshPos.z;

        // Find matching building
        for (const building of buildings) {
          if (Math.abs(building.worldX - actualX) < 0.1 &&
              Math.abs(building.worldZ - actualZ) < 0.1) {
            hitBuilding = building;
            hitPoint = intersect.point;
            break;
          }
        }
        if (hitBuilding) break;
      }

      // Update ghost billboard position if we hit a building
      if (hitBuilding && hitPoint) {
        const coords = convertWorldToFaceCoordinates(hitPoint, hitBuilding);
        if (coords) {
          // Constrain position to keep billboard fully within face bounds
          const constrained = constrainBillboardPosition(coords.positionX, coords.positionY, hitBuilding);

          // Calculate billboard size: 80% of building width (matching actual billboards)
          const billboardWidth = hitBuilding.width * 0.8;
          const billboardHeight = billboardWidth * 0.75; // 4:3 aspect ratio

          const billboardData = {
            building: hitBuilding,
            face: coords.face,
            positionX: constrained.positionX,
            positionY: constrained.positionY,
            width: billboardWidth,
            height: billboardHeight,
          };
          ghostBillboardRef.current = billboardData;
          onGhostBillboardChange?.(billboardData);
        }
      } else {
        ghostBillboardRef.current = null;
        onGhostBillboardChange?.(null);
      }
    }

    // Throttled raycast - only check every 150ms instead of every frame (60fps)
    const currentTime = Date.now();
    if (currentTime - lastRaycastTime.current > RAYCAST_INTERVAL) {
      lastRaycastTime.current = currentTime;

      // Raycast from center of screen to detect targeted building
      camera.getWorldDirection(direction.current);
      raycaster.current.set(camera.position, direction.current);

      // Only raycast against meshes (not the entire scene recursively)
      const meshes = scene.children.filter(child =>
        child.type === 'Group' || child.type === 'Mesh'
      );
      const intersects = raycaster.current.intersectObjects(meshes, true);

      // Find the first building hit
      let targetedBuilding: BuildingData | null = null;
      for (const intersect of intersects) {
        // Check if this mesh belongs to a building by matching position
        const meshPos = intersect.object.position;
        const parentPos = intersect.object.parent?.position;

        // The actual position might be in parent (group)
        const actualX = parentPos ? parentPos.x : meshPos.x;
        const actualZ = parentPos ? parentPos.z : meshPos.z;

        // Find matching building (simple distance check)
        for (const building of buildings) {
          if (Math.abs(building.worldX - actualX) < 0.1 &&
              Math.abs(building.worldZ - actualZ) < 0.1) {
            targetedBuilding = building;
            break;
          }
        }
        if (targetedBuilding) break;
      }

      // Notify parent if target changed
      if (targetedBuilding !== lastTargetBuilding.current) {
        lastTargetBuilding.current = targetedBuilding;
        onTargetChange?.(targetedBuilding);
      }
    }
  });

  return <PointerLockControls />;
}
