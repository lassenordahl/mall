import { useState, useCallback } from 'react';

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
  chunkX: number;
  chunkZ: number;
}

const CHUNK_SIZE = 150; // 5 cells * 30 units per cell

function worldToChunk(worldX: number, worldZ: number) {
  return {
    chunkX: Math.floor(worldX / CHUNK_SIZE),
    chunkZ: Math.floor(worldZ / CHUNK_SIZE),
  };
}

/**
 * Hook to track and broadcast player position
 * Returns current position and a setter to update it
 */
export function usePlayerPosition() {
  const [position, setPosition] = useState<PlayerPosition | null>(null);

  const updatePosition = useCallback((worldX: number, worldY: number, worldZ: number) => {
    const { chunkX, chunkZ } = worldToChunk(worldX, worldZ);

    setPosition(prev => {
      // Only update if chunk changed or first update
      if (!prev || prev.chunkX !== chunkX || prev.chunkZ !== chunkZ) {
        console.log(`[usePlayerPosition] Player moved to chunk (${chunkX}, ${chunkZ})`);
        return { x: worldX, y: worldY, z: worldZ, chunkX, chunkZ };
      }
      // Same chunk, just update world coords silently
      return { x: worldX, y: worldY, z: worldZ, chunkX, chunkZ };
    });
  }, []);

  return {
    position,
    updatePosition,
  };
}
