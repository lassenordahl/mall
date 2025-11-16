import { useEffect, useRef } from 'react';
import { useStats } from '@/hooks/api';

interface MinimapProps {
  newChunkKeys: string[]; // Array of "x,z" keys for new chunks
  playerPosition?: [number, number, number]; // [x, y, z] in world coords
  cameraYaw?: number; // Camera rotation in radians
}

const MINIMAP_SIZE = 250; // pixels
const CELL_SIZE = 8; // pixels per chunk

export function Minimap({ newChunkKeys, playerPosition, cameraYaw = 0 }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use TanStack Query hook with auto-refresh every 5 seconds
  const { data: stats } = useStats({ refetchInterval: 5000 });

  // Render minimap
  useEffect(() => {
    if (!stats || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    const { chunkBounds, chunkCoords } = stats;

    // Parse newChunkKeys into coordinates
    const newChunkCoords = newChunkKeys.map(key => {
      const [x, z] = key.split(',').map(Number);
      return [x, z] as [number, number];
    });

    // Combine all chunks (from stats + new chunks not yet in DB)
    const allChunkCoordsMap = new Map<string, [number, number]>();

    // Add chunks from stats
    for (const coord of chunkCoords) {
      allChunkCoordsMap.set(`${coord[0]},${coord[1]}`, coord);
    }

    // Add new chunks (may overlap with stats, that's ok)
    for (const coord of newChunkCoords) {
      allChunkCoordsMap.set(`${coord[0]},${coord[1]}`, coord);
    }

    const allChunkCoords = Array.from(allChunkCoordsMap.values());

    // Recalculate bounds including new chunks
    let minX = chunkBounds.minX;
    let maxX = chunkBounds.maxX;
    let minZ = chunkBounds.minZ;
    let maxZ = chunkBounds.maxZ;

    if (allChunkCoords.length > 0) {
      minX = Math.min(...allChunkCoords.map(c => c[0]));
      maxX = Math.max(...allChunkCoords.map(c => c[0]));
      minZ = Math.min(...allChunkCoords.map(c => c[1]));
      maxZ = Math.max(...allChunkCoords.map(c => c[1]));
    }

    // Calculate grid dimensions
    const gridWidth = maxX - minX + 1;
    const gridHeight = maxZ - minZ + 1;

    // Calculate scale to fit in minimap
    const scaleX = (MINIMAP_SIZE - 20) / gridWidth;
    const scaleY = (MINIMAP_SIZE - 20) / gridHeight;
    const scale = Math.min(scaleX, scaleY, CELL_SIZE);

    const offsetX = (MINIMAP_SIZE - gridWidth * scale) / 2;
    const offsetY = (MINIMAP_SIZE - gridHeight * scale) / 2;

    // Convert new chunk keys to set for quick lookup
    const newChunksSet = new Set(newChunkKeys);

    // Draw all chunks
    for (const [cx, cz] of allChunkCoords) {
      const x = offsetX + (cx - minX) * scale;
      const y = offsetY + (cz - minZ) * scale;

      const chunkKey = `${cx},${cz}`;
      const isNew = newChunksSet.has(chunkKey);

      // Fill chunk
      ctx.fillStyle = isNew ? '#00ff00' : '#cccccc';
      ctx.fillRect(x, y, scale - 1, scale - 1);

      // Border
      ctx.strokeStyle = isNew ? '#00aa00' : '#999999';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, scale - 1, scale - 1);
    }

    // Draw player position if available
    if (playerPosition) {
      const [worldX, , worldZ] = playerPosition;
      // Convert world coords to chunk coords
      const playerChunkX = Math.floor(worldX / 150); // 150 = chunk size
      const playerChunkZ = Math.floor(worldZ / 150);

      const px = offsetX + (playerChunkX - minX) * scale + scale / 2;
      const py = offsetY + (playerChunkZ - minZ) * scale + scale / 2;

      // Draw red dot for player
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw white border around dot
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.stroke();

      // Draw directional indicator (vision cone/fan)
      const coneRadius = 25;
      const coneAngle = Math.PI / 2; // 90 degrees (quarter circle)

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(cameraYaw);

      // Create radial gradient for fading effect
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, coneRadius);
      gradient.addColorStop(0, 'rgba(255, 200, 0, 0.5)'); // bright at center
      gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.25)'); // fade
      gradient.addColorStop(1, 'rgba(255, 200, 0, 0)'); // transparent at edge

      // Draw cone/fan shape
      ctx.beginPath();
      ctx.moveTo(0, 0); // start at player position
      ctx.arc(0, 0, coneRadius, -coneAngle / 2, coneAngle / 2, false);
      ctx.closePath();

      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.restore();
    }

    // Draw border around minimap
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  }, [stats, newChunkKeys, playerPosition, cameraYaw]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '10px',
        borderRadius: '5px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#333',
          marginBottom: '5px',
          textAlign: 'center',
          fontWeight: 'bold',
        }}
      >
        MINIMAP
      </div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
        }}
      />
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#666',
          marginTop: '5px',
          textAlign: 'center',
        }}
      >
        <span style={{ color: '#00aa00' }}>■</span> New
        {' | '}
        <span style={{ color: '#999' }}>■</span> Cached
        {' | '}
        <span style={{ color: '#ff0000' }}>●</span> You
      </div>
    </div>
  );
}
