/**
 * Type-safe API client for 3D Neighborhood
 * All API endpoints with proper typing and error handling
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get the API base URL from environment variables or fall back to default
 */
export function getApiBaseUrl(): string {
  // Check for Vite environment variable (client-side)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL;
  }

  // Fallback to /api for development with Vite proxy
  return '/api';
}

// ============================================================================
// Types
// ============================================================================

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
    billboard?: import('./types').BillboardData;  // Billboard data for this building
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

export interface Website {
  url: string;
  title: string;
  favicon: string;
}

export interface SearchWebsitesResponse extends Array<Website> {}

export interface EntryPointRequest {
  url: string;
}

export interface EntryPointResponse {
  chunkX: number;
  chunkZ: number;
  buildingIndex: number;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiBaseUrl();
  }

  /**
   * Internal fetch wrapper with error handling
   */
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;

    try {
      const res = await fetch(url, options);

      if (!res.ok) {
        let errorMessage = `API request failed: ${res.status} ${res.statusText}`;
        try {
          const err = await res.json() as ErrorResponse;
          errorMessage = err.message || err.error || errorMessage;
        } catch {
          // Failed to parse error, use default
        }
        throw new Error(errorMessage);
      }

      return res.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  /**
   * Search websites by query string
   * GET /api/websites?q=<query>
   */
  async searchWebsites(query: string): Promise<SearchWebsitesResponse> {
    if (query.length < 2) {
      return [];
    }
    return this.fetch<SearchWebsitesResponse>(`/websites?q=${encodeURIComponent(query)}`);
  }

  /**
   * Get entry point (spawn location) for a specific website
   * POST /api/entry-point
   */
  async getEntryPoint(url: string): Promise<EntryPointResponse> {
    return this.fetch<EntryPointResponse>('/entry-point', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url } as EntryPointRequest),
    });
  }

  /**
   * Get chunk data (cached or generated)
   * GET /api/chunks/:cx/:cz
   */
  async getChunk(cx: number, cz: number): Promise<ChunkWithMetadata> {
    const url = `${this.baseUrl}/api/chunks/${cx}/${cz}`;

    const res = await fetch(url);

    if (!res.ok) {
      let errorMessage = `Failed to fetch chunk (${cx}, ${cz})`;
      try {
        const err = await res.json() as ErrorResponse;
        errorMessage = err.message || err.error || errorMessage;
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
   * Get world statistics
   * GET /api/stats
   */
  async getStats(): Promise<StatsResponse> {
    return this.fetch<StatsResponse>('/stats');
  }
}

// ============================================================================
// Singleton Instance & Legacy Functions
// ============================================================================

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Legacy function for backward compatibility
 * @deprecated Use apiClient.getChunk() instead
 */
export async function fetchChunk(
  cx: number,
  cz: number,
  baseUrl?: string
): Promise<ChunkWithMetadata> {
  const client = baseUrl ? new ApiClient(baseUrl) : apiClient;
  return client.getChunk(cx, cz);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use apiClient.getStats() instead
 */
export async function fetchStats(baseUrl?: string): Promise<StatsResponse> {
  const client = baseUrl ? new ApiClient(baseUrl) : apiClient;
  return client.getStats();
}
