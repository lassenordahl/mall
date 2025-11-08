import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingData } from '@3d-neighborhood/shared';

interface PlayerProps {
  buildings: BuildingData[];
  onTargetChange?: (building: BuildingData | null) => void;
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
export function Player({ buildings, onTargetChange }: PlayerProps) {
  const { camera, scene } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const lastCollisionAlert = useRef<number>(0); // Throttle collision alerts
  const hasSetSpawnPosition = useRef(false);
  const raycaster = useRef(new THREE.Raycaster());
  const lastTargetBuilding = useRef<BuildingData | null>(null);
  const lastRaycastTime = useRef(0);
  const RAYCAST_INTERVAL = 150; // Only raycast every 150ms instead of every frame

  // Set spawn position once buildings are loaded
  if (buildings.length > 0 && !hasSetSpawnPosition.current) {
    const safePos = findSafeSpawnPosition(buildings);
    camera.position.set(safePos[0], safePos[1], safePos[2]);
    hasSetSpawnPosition.current = true;
    console.log(`Spawned at safe position: ${safePos[0]}, ${safePos[2]}`);
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

  // Update movement each frame
  useFrame((state, delta) => {
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

    // Check for collisions at new position
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

    // Keep camera at eye level (1.6 units above ground)
    camera.position.y = 1.6;

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
