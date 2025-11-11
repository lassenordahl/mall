/**
 * Type-safe API contracts between client and server
 */

export interface ChunkResponse {
  chunkX: number;
  chunkZ: number;
  worldVersion: number;
  buildings: Array<{
    url: string;
    gridX: number;
    gridZ: number;
    worldX: number;
    worldZ: number;
    width: number;
    height: number;
    title?: string;  // From database
  }>;
}

export interface ChunkWithMetadata {
  chunk: ChunkResponse;
  cacheStatus: 'hit' | 'miss';
}

export interface StatsResponse {
  totalWebsites: number;
  placedWebsites: number;
  totalChunks: number;
  chunkBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  chunkCoords: Array<[number, number]>;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Type-safe fetch wrapper for chunk data with cache status
 */
export async function fetchChunk(
  cx: number,
  cz: number,
  baseUrl = '/api'
): Promise<ChunkWithMetadata> {
  const url = `${baseUrl}/chunks/${cx}/${cz}`;

  const res = await fetch(url);

  if (!res.ok) {
    let errorMessage = `Failed to fetch chunk (${cx}, ${cz})`;
    try {
      const err = await res.json() as ErrorResponse;
      errorMessage = err.message;
    } catch {
      // Failed to parse error, use default
    }
    throw new Error(errorMessage);
  }

  const chunk = await res.json() as ChunkResponse;
  const cacheStatus = (res.headers.get('X-Chunk-Cache-Status') || 'hit') as 'hit' | 'miss';

  return { chunk, cacheStatus };
}

/**
 * Fetch world statistics
 */
export async function fetchStats(baseUrl = '/api'): Promise<StatsResponse> {
  const url = `${baseUrl}/stats`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error('Failed to fetch stats');
  }

  return res.json() as Promise<StatsResponse>;
}
