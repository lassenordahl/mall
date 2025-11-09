/**
 * 3D Neighborhood API Server
 * Cloudflare Workers + Hono + D1
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ChunkResponse, ErrorResponse } from '@3d-neighborhood/shared/api';
import { findSimilarWebsites } from './knn';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for client
app.use('/*', cors());

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Get chunk data (cached or generated)
 * GET /api/chunks/:cx/:cz
 */
app.get('/api/chunks/:cx/:cz', async (c) => {
  const cx = parseInt(c.req.param('cx'));
  const cz = parseInt(c.req.param('cz'));

  if (isNaN(cx) || isNaN(cz)) {
    return c.json<ErrorResponse>(
      {
        error: 'INVALID_PARAMS',
        message: 'Chunk coordinates must be integers',
      },
      400
    );
  }

  try {
    // Check cache first
    const cached = await c.env.DB.prepare(
      'SELECT data FROM chunks WHERE chunk_x = ? AND chunk_z = ?'
    )
      .bind(cx, cz)
      .first<{ data: string }>();

    if (cached) {
      return c.json<ChunkResponse>(JSON.parse(cached.data));
    }

    // Generate new chunk
    const chunkData = await generateChunk(c.env.DB, cx, cz);

    // Cache it
    await c.env.DB.prepare(
      'INSERT INTO chunks (chunk_x, chunk_z, data, world_version) VALUES (?, ?, ?, ?)'
    )
      .bind(cx, cz, JSON.stringify(chunkData), 1)
      .run();

    return c.json<ChunkResponse>(chunkData);
  } catch (error) {
    console.error('Error generating chunk:', error);
    return c.json<ErrorResponse>(
      {
        error: 'GENERATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate chunk',
      },
      500
    );
  }
});

/**
 * Get anchor URLs from adjacent chunks for semantic clustering
 * SCALABILITY: Caps and parallelizes queries to prevent slowdown
 */
async function getAdjacentChunkAnchors(
  db: D1Database,
  cx: number,
  cz: number
): Promise<string[]> {
  // Query all 8 adjacent chunks
  const adjacentCoords = [
    [cx - 1, cz - 1], [cx - 1, cz], [cx - 1, cz + 1],
    [cx, cz - 1],                   [cx, cz + 1],
    [cx + 1, cz - 1], [cx + 1, cz], [cx + 1, cz + 1],
  ];

  // SCALABILITY FIX: Parallel queries instead of sequential
  const chunkQueries = adjacentCoords.map(([adjX, adjZ]) =>
    db.prepare('SELECT data FROM chunks WHERE chunk_x = ? AND chunk_z = ?')
      .bind(adjX, adjZ)
      .first<{ data: string }>()
  );

  const results = await Promise.all(chunkQueries);

  const anchors: string[] = [];
  for (const chunk of results) {
    if (chunk?.data) {
      const chunkData: ChunkResponse = JSON.parse(chunk.data);
      anchors.push(...chunkData.buildings.map(b => b.url));
    }
  }

  // SCALABILITY CAP: Limit total anchors to prevent excessive k-NN queries
  const MAX_ANCHORS = 50;
  return anchors.slice(0, MAX_ANCHORS);
}

/**
 * Chunk generation with semantic clustering
 * Uses adjacent chunks as k-NN anchors to create semantic neighborhoods
 */
async function generateChunk(
  db: D1Database,
  cx: number,
  cz: number
): Promise<ChunkResponse> {
  const CHUNK_SIZE = 5;
  const CELL_SIZE = 30;
  const buildings: ChunkResponse['buildings'] = [];

  // Simple deterministic seed
  const seed = (cx * 73856093) ^ (cz * 19349663);
  let rng = seed;
  const random = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  // Get anchor URLs from adjacent chunks
  const adjacentAnchors = await getAdjacentChunkAnchors(db, cx, cz);

  let candidateUrls: string[];

  if (adjacentAnchors.length > 0) {
    // Use adjacent chunks' buildings as anchors for k-NN
    console.log(`Chunk (${cx}, ${cz}): Using ${adjacentAnchors.length} anchors from adjacent chunks`);

    // SCALABILITY CAPS:
    // - Use only first 5 anchors (prevents too many k-NN queries)
    // - Query 10 similar sites per anchor (50 total max)
    // - Current: 548 sites (~850KB) works fine in-memory
    // - Future: 1M+ sites will need Cloudflare Vectorize (indexed k-NN)
    const MAX_KNN_ANCHORS = 5;
    const NEIGHBORS_PER_ANCHOR = 10;

    const allSimilar = await Promise.all(
      adjacentAnchors.slice(0, MAX_KNN_ANCHORS).map(anchor =>
        findSimilarWebsites(db, anchor, NEIGHBORS_PER_ANCHOR)
      )
    );

    // Flatten and deduplicate
    const similarSet = new Set(allSimilar.flat());
    candidateUrls = Array.from(similarSet);

    // If we didn't get enough candidates, add the anchors themselves
    if (candidateUrls.length < 20) {
      candidateUrls.push(...adjacentAnchors);
      candidateUrls = Array.from(new Set(candidateUrls)); // Deduplicate
    }
  } else {
    // No adjacent chunks - use random anchor (origin chunk)
    console.log(`Chunk (${cx}, ${cz}): No adjacent chunks, using random anchor`);

    const anchorRow = await db
      .prepare('SELECT url FROM websites ORDER BY RANDOM() LIMIT 1')
      .first<{ url: string }>();

    if (!anchorRow) {
      throw new Error('No websites in database');
    }

    // Find similar websites
    candidateUrls = await findSimilarWebsites(db, anchorRow.url, 50);
  }

  // Generate 4x4 grid of buildings (roads at center row/col)
  for (let gridX = 0; gridX < CHUNK_SIZE; gridX++) {
    for (let gridZ = 0; gridZ < CHUNK_SIZE; gridZ++) {
      // Skip road cells (center row/col 2)
      if (gridX === 2 || gridZ === 2) continue;

      // Pick a website
      const url = candidateUrls[Math.floor(random() * candidateUrls.length)];

      // Calculate position
      const baseX = cx * CHUNK_SIZE * CELL_SIZE + gridX * CELL_SIZE;
      const baseZ = cz * CHUNK_SIZE * CELL_SIZE + gridZ * CELL_SIZE;

      // Add noise offset (simplified)
      const offsetX = (random() - 0.5) * 16; // ±8 units
      const offsetZ = (random() - 0.5) * 16;

      const worldX = baseX + offsetX;
      const worldZ = baseZ + offsetZ;

      // Building size
      const width = 15 + random() * 13; // 15-28
      const height = 25 + random() * 95; // 25-120

      buildings.push({
        url,
        gridX,
        gridZ,
        worldX,
        worldZ,
        width,
        height,
      });
    }
  }

  return {
    chunkX: cx,
    chunkZ: cz,
    worldVersion: 1,
    buildings,
  };
}

export default app;
