import { useStats } from '@/hooks/api';

interface StatsPanelProps {
  newChunksThisSession: number;
}

export function StatsPanel({ newChunksThisSession }: StatsPanelProps) {
  // Use TanStack Query hook with auto-refresh every 10 seconds
  const { data: stats, isLoading, error } = useStats({ refetchInterval: 10000 });

  if (isLoading && !stats) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: '#333',
          fontFamily: 'monospace',
          fontSize: '12px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '15px',
          borderRadius: '5px',
          pointerEvents: 'none',
          minWidth: '220px',
        }}
      >
        Loading stats...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: '#cc0000',
          fontFamily: 'monospace',
          fontSize: '12px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '15px',
          borderRadius: '5px',
          pointerEvents: 'none',
          minWidth: '220px',
        }}
      >
        Error loading stats
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: '#333',
        fontFamily: 'monospace',
        fontSize: '12px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '15px',
        borderRadius: '5px',
        pointerEvents: 'none',
        minWidth: '220px',
        lineHeight: '1.6',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        WORLD STATS
      </div>
      <div>Websites: {stats.totalWebsites.toLocaleString()}</div>
      <div>Placed: {stats.placedWebsites.toLocaleString()}</div>
      <div>Total Chunks: {stats.totalChunks.toLocaleString()}</div>
      <div style={{ color: '#00aa00', fontWeight: 'bold' }}>
        New This Session: {newChunksThisSession}
      </div>
      <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
        Bounds: ({stats.chunkBounds.minX}, {stats.chunkBounds.minZ}) to ({stats.chunkBounds.maxX}, {stats.chunkBounds.maxZ})
      </div>
    </div>
  );
}
