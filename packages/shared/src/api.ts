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

export interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Type-safe fetch wrapper for chunk data
 */
export async function fetchChunk(
  cx: number,
  cz: number,
  baseUrl = '/api'
): Promise<ChunkResponse> {
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

  return res.json() as Promise<ChunkResponse>;
}
