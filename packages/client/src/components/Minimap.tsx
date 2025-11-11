import { useEffect, useRef, useState } from 'react';
import { fetchStats } from '@3d-neighborhood/shared/api';
import type { StatsResponse } from '@3d-neighborhood/shared/api';

interface MinimapProps {
  newChunkKeys: string[]; // Array of "x,z" keys for new chunks
  playerPosition?: [number, number, number]; // [x, y, z] in world coords
}

const MINIMAP_SIZE = 250; // pixels
const CELL_SIZE = 8; // pixels per chunk

export function Minimap({ newChunkKeys, playerPosition }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);

  // Fetch stats for chunk data - refetch when new chunks are added
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchStats();
        setStats(data);
        console.log('[Minimap] Loaded stats, total chunks:', data.totalChunks);
      } catch (err) {
        console.error('[Minimap] Failed to load stats:', err);
      }
    };

    loadStats();

    // Also refetch every 5 seconds to catch new chunks
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [newChunkKeys.length]); // Refetch when newChunkKeys changes

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
    const { minX, maxX, minZ, maxZ } = chunkBounds;

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
    for (const [cx, cz] of chunkCoords) {
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
    }

    // Draw border around minimap
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  }, [stats, newChunkKeys, playerPosition]);

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
