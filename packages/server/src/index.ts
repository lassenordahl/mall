/**
 * 3D Neighborhood API Server
 * Cloudflare Workers + Hono + D1
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ChunkResponse, ErrorResponse } from '@3d-neighborhood/shared/api';
import { findSimilarWebsites } from './knn';
import { checkDatabase } from './db-check';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for client
app.use('/*', cors());

/**
 * Health check endpoint
 */
app.get('/health', async (c) => {
  const dbCheck = await checkDatabase(c.env.DB);

  if (!dbCheck.healthy) {
    console.error('\n' + dbCheck.message + '\n');
    return c.json({ status: 'error', error: 'Database not ready', details: dbCheck.message }, 503);
  }

  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Search websites for autocomplete
 * GET /api/websites?q=search
 */
app.get('/api/websites', async (c) => {
  const query = c.req.query('q') || '';

  if (query.length < 2) {
    return c.json([]);
  }

  try {
    // Search by URL or title (case-insensitive)
    const results = await c.env.DB.prepare(`
      SELECT url, title
      FROM websites
      WHERE url LIKE ? OR title LIKE ?
      ORDER BY popularity_score DESC
      LIMIT 10
    `)
      .bind(`%${query}%`, `%${query}%`)
      .all<{ url: string; title: string | null }>();

    return c.json(
      results.results.map(r => ({
        url: r.url,
        title: r.title || r.url,
        favicon: `https://www.google.com/s2/favicons?domain=${r.url}&sz=32`,
      }))
    );
  } catch (error) {
    console.error('Error searching websites:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

/**
 * Get entry point (spawn location) for a specific website
 * POST /api/entry-point
 */
app.post('/api/entry-point', async (c) => {
  const { url } = await c.req.json<{ url: string }>();

  if (!url) {
    return c.json({ error: 'URL required' }, 400);
  }

  try {
    // Check if website exists
    const website = await c.env.DB.prepare('SELECT url FROM websites WHERE url = ?')
      .bind(url)
      .first<{ url: string }>();

    if (!website) {
      return c.json({ error: 'Website not found' }, 404);
    }

    // Search all chunks for this building
    const chunks = await c.env.DB.prepare('SELECT chunk_x, chunk_z, data FROM chunks')
      .all<{ chunk_x: number; chunk_z: number; data: string }>();

    for (const chunk of chunks.results) {
      const chunkData: ChunkResponse = JSON.parse(chunk.data);
      const buildingIndex = chunkData.buildings.findIndex(b => b.url === url);

      if (buildingIndex !== -1) {
        const building = chunkData.buildings[buildingIndex];

        // Buildings are on 5x5 grid with roads at gridX=2 OR gridZ=2 (cross pattern)
        const CELL_SIZE = 30;
        const CHUNK_SIZE = 5;

        // Calculate which road is closest to the building
        const distToVerticalRoad = Math.abs(building.gridX - 2);
        const distToHorizontalRoad = Math.abs(building.gridZ - 2);

        let spawnX: number;
        let spawnZ: number;
        const spawnY = 1.6; // Eye height

        // Choose the closer road, spawn aligned with building's actual world position
        if (distToVerticalRoad < distToHorizontalRoad) {
          // Spawn on vertical road (gridX=2), at building's Z coordinate
          const roadCenterX = chunk.chunk_x * CHUNK_SIZE * CELL_SIZE + 2 * CELL_SIZE + CELL_SIZE / 2;
          spawnX = roadCenterX;
          spawnZ = building.worldZ; // Align with building's actual position
          console.log(`Spawning on vertical road for ${url}: grid(${building.gridX},${building.gridZ}) -> spawn(${spawnX}, ${spawnZ})`);
        } else {
          // Spawn on horizontal road (gridZ=2), at building's X coordinate
          const roadCenterZ = chunk.chunk_z * CHUNK_SIZE * CELL_SIZE + 2 * CELL_SIZE + CELL_SIZE / 2;
          spawnX = building.worldX; // Align with building's actual position
          spawnZ = roadCenterZ;
          console.log(`Spawning on horizontal road for ${url}: grid(${building.gridX},${building.gridZ}) -> spawn(${spawnX}, ${spawnZ})`);
        }

        return c.json({
          chunkX: chunk.chunk_x,
          chunkZ: chunk.chunk_z,
          buildingIndex,
          spawnX,
          spawnY,
          spawnZ,
          lookAtX: building.worldX,
          lookAtY: building.height / 2,
          lookAtZ: building.worldZ,
        });
      }
    }

    // Website exists but not placed yet - generate new island chunk
    // Pick random coordinates far from origin to avoid immediate clustering
    const randomChunkX = Math.floor(Math.random() * 20 - 10); // -10 to 10
    const randomChunkZ = Math.floor(Math.random() * 20 - 10);

    // Generate chunk with this URL as primary anchor
    const newChunkData = await generateChunkWithAnchor(c.env.DB, randomChunkX, randomChunkZ, url);

    // Cache it
    await c.env.DB.prepare(
      'INSERT INTO chunks (chunk_x, chunk_z, data, world_version) VALUES (?, ?, ?, ?)'
    )
      .bind(randomChunkX, randomChunkZ, JSON.stringify(newChunkData), 1)
      .run();

    // Find the building we just placed
    const buildingIndex = newChunkData.buildings.findIndex(b => b.url === url);
    if (buildingIndex === -1) {
      return c.json({ error: 'Failed to place website in new chunk' }, 500);
    }

    const building = newChunkData.buildings[buildingIndex];

    // Calculate spawn point (same logic as above)
    const CELL_SIZE = 30;
    const CHUNK_SIZE = 5;
    const distToVerticalRoad = Math.abs(building.gridX - 2);
    const distToHorizontalRoad = Math.abs(building.gridZ - 2);

    let spawnX: number;
    let spawnZ: number;
    const spawnY = 1.6;

    if (distToVerticalRoad < distToHorizontalRoad) {
      const roadCenterX = randomChunkX * CHUNK_SIZE * CELL_SIZE + 2 * CELL_SIZE + CELL_SIZE / 2;
      spawnX = roadCenterX;
      spawnZ = building.worldZ;
      console.log(`Spawning on vertical road for ${url}: grid(${building.gridX},${building.gridZ}) -> spawn(${spawnX}, ${spawnZ})`);
    } else {
      const roadCenterZ = randomChunkZ * CHUNK_SIZE * CELL_SIZE + 2 * CELL_SIZE + CELL_SIZE / 2;
      spawnX = building.worldX;
      spawnZ = roadCenterZ;
      console.log(`Spawning on horizontal road for ${url}: grid(${building.gridX},${building.gridZ}) -> spawn(${spawnX}, ${spawnZ})`);
    }

    return c.json({
      chunkX: randomChunkX,
      chunkZ: randomChunkZ,
      buildingIndex,
      spawnX,
      spawnY,
      spawnZ,
      lookAtX: building.worldX,
      lookAtY: building.height / 2,
      lookAtZ: building.worldZ,
    });
  } catch (error) {
    console.error('Error finding entry point:', error);
    return c.json({ error: 'Failed to find entry point' }, 500);
  }
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

    let chunkData: ChunkResponse;
    let cacheStatus: 'hit' | 'miss';

    if (cached) {
      chunkData = JSON.parse(cached.data);
      cacheStatus = 'hit';
    } else {
      // Generate new chunk
      chunkData = await generateChunk(c.env.DB, cx, cz);

      // Cache it
      await c.env.DB.prepare(
        'INSERT INTO chunks (chunk_x, chunk_z, data, world_version) VALUES (?, ?, ?, ?)'
      )
        .bind(cx, cz, JSON.stringify(chunkData), 1)
        .run();

      cacheStatus = 'miss';
    }

    // Fetch billboard data for all buildings in this chunk
    const buildingUrls = chunkData.buildings.map(b => b.url);
    if (buildingUrls.length > 0) {
      const placeholders = buildingUrls.map(() => '?').join(',');
      const billboards = await c.env.DB.prepare(
        `SELECT
          id, building_url, face, position_x, position_y,
          width, height, image_url, owner_user_id,
          purchased_at, expires_at
         FROM billboards
         WHERE building_url IN (${placeholders})`
      )
        .bind(...buildingUrls)
        .all<{
          id: number;
          building_url: string;
          face: string;
          position_x: number;
          position_y: number;
          width: number;
          height: number;
          image_url: string | null;
          owner_user_id: number | null;
          purchased_at: string | null;
          expires_at: string | null;
        }>();

      // Merge billboard data into buildings
      const billboardMap = new Map(
        billboards.results.map(b => [b.building_url, b])
      );

      chunkData.buildings = chunkData.buildings.map(building => {
        const billboard = billboardMap.get(building.url);
        if (billboard) {
          return {
            ...building,
            billboard: {
              id: billboard.id,
              buildingUrl: billboard.building_url,
              face: billboard.face as 'north' | 'south' | 'east' | 'west' | 'top',
              positionX: billboard.position_x,
              positionY: billboard.position_y,
              width: billboard.width,
              height: billboard.height,
              imageUrl: billboard.image_url,
              ownerUserId: billboard.owner_user_id,
              purchasedAt: billboard.purchased_at,
              expiresAt: billboard.expires_at,
            },
          };
        }
        return building;
      });
    }

    const response = c.json<ChunkResponse>(chunkData);
    response.headers.set('X-Chunk-Cache-Status', cacheStatus);
    return response;
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
 * Get world statistics for stats panel and minimap
 * GET /api/stats
 */
app.get('/api/stats', async (c) => {
  try {
    // Get total websites count
    const totalWebsitesResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM websites'
    ).first<{ count: number }>();
    const totalWebsites = totalWebsitesResult?.count || 0;

    // Get placed websites count (distinct URLs in placements)
    const placedWebsitesResult = await c.env.DB.prepare(
      'SELECT COUNT(DISTINCT url) as count FROM placements'
    ).first<{ count: number }>();
    const placedWebsites = placedWebsitesResult?.count || 0;

    // Get total chunks count
    const totalChunksResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM chunks'
    ).first<{ count: number }>();
    const totalChunks = totalChunksResult?.count || 0;

    // Get all chunk coordinates for minimap
    const chunksData = await c.env.DB.prepare(
      'SELECT chunk_x, chunk_z FROM chunks ORDER BY chunk_x, chunk_z'
    ).all<{ chunk_x: number; chunk_z: number }>();

    const chunkCoords = chunksData.results.map(row => [row.chunk_x, row.chunk_z]);

    // Calculate bounds
    let minX = 0, maxX = 0, minZ = 0, maxZ = 0;
    if (chunkCoords.length > 0) {
      minX = Math.min(...chunkCoords.map(c => c[0]));
      maxX = Math.max(...chunkCoords.map(c => c[0]));
      minZ = Math.min(...chunkCoords.map(c => c[1]));
      maxZ = Math.max(...chunkCoords.map(c => c[1]));
    }

    return c.json({
      totalWebsites,
      placedWebsites,
      totalChunks,
      chunkBounds: { minX, maxX, minZ, maxZ },
      chunkCoords,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json(
      { error: 'Failed to fetch stats' },
      500
    );
  }
});

/**
 * Record placements for all buildings in a chunk
 */
async function recordPlacements(
  db: D1Database,
  cx: number,
  cz: number,
  buildings: ChunkResponse['buildings']
): Promise<void> {
  if (buildings.length === 0) return;

  // Batch insert all placements
  const statements = buildings.map((building) =>
    db.prepare(`
      INSERT OR IGNORE INTO placements
      (url, chunk_x, chunk_z, grid_x, grid_z, world_x, world_z)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      building.url,
      cx,
      cz,
      building.gridX,
      building.gridZ,
      building.worldX,
      building.worldZ
    )
  );

  await db.batch(statements);
  console.log(`Recorded ${buildings.length} placements for chunk (${cx}, ${cz})`);
}

/**
 * Record billboards for all buildings in a chunk
 * Creates 1 billboard per building on a random face
 */
async function recordBillboards(
  db: D1Database,
  seed: number,
  buildings: ChunkResponse['buildings']
): Promise<void> {
  if (buildings.length === 0) return;

  // Use seed-based RNG for deterministic billboard placement
  let rng = seed;
  const random = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };

  const faces = ['north', 'south', 'east', 'west', 'top'];

  // Batch insert all billboards
  const statements = buildings.map((building) => {
    const face = faces[Math.floor(random() * faces.length)];
    const positionX = 0.5; // Centered horizontally
    const positionY = 0.75; // 75% up the face
    const width = 8; // 8 world units wide
    const height = 6; // 6 world units tall

    return db.prepare(`
      INSERT OR IGNORE INTO billboards
      (building_url, face, position_x, position_y, width, height)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      building.url,
      face,
      positionX,
      positionY,
      width,
      height
    );
  });

  await db.batch(statements);
  console.log(`Recorded ${buildings.length} billboards`);
}

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
 * Generate chunk with a specific URL guaranteed to be placed
 * Used for entry points to create new "islands"
 */
async function generateChunkWithAnchor(
  db: D1Database,
  cx: number,
  cz: number,
  anchorUrl: string
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

  // Get similar websites to the anchor
  const candidateUrls = await findSimilarWebsites(db, anchorUrl, 50);

  // Ensure anchor URL is first in list
  const urlsToPlace = [anchorUrl, ...candidateUrls.filter(u => u !== anchorUrl)];

  // Generate 4x4 grid of buildings (roads at center row/col)
  let urlIndex = 0;
  for (let gridX = 0; gridX < CHUNK_SIZE; gridX++) {
    for (let gridZ = 0; gridZ < CHUNK_SIZE; gridZ++) {
      // Skip road cells (center row/col 2)
      if (gridX === 2 || gridZ === 2) continue;

      // Pick a website
      const url = urlsToPlace[urlIndex % urlsToPlace.length];
      urlIndex++;

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

  // Record placements for all buildings
  await recordPlacements(db, cx, cz, buildings);

  // Note: Billboards are no longer auto-generated during chunk creation
  // They are managed as fixtures in seed data or created via API

  return {
    chunkX: cx,
    chunkZ: cz,
    worldVersion: 1,
    buildings,
  };
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

  // Record placements for all buildings
  await recordPlacements(db, cx, cz, buildings);

  // Note: Billboards are no longer auto-generated during chunk creation
  // They are managed as fixtures in seed data or created via API

  return {
    chunkX: cx,
    chunkZ: cz,
    worldVersion: 1,
    buildings,
  };
}

/**
 * Create/purchase a billboard
 * POST /api/billboards
 */
app.post('/api/billboards', async (c) => {
  const { buildingUrl, face, positionX, positionY, width, height, imageUrl } = await c.req.json<{
    buildingUrl: string;
    face: 'north' | 'south' | 'east' | 'west' | 'top';
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    imageUrl?: string | null;
  }>();

  // Validation
  if (!buildingUrl || !face || positionX === undefined || positionY === undefined || !width || !height) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (positionX < 0 || positionX > 1 || positionY < 0 || positionY > 1) {
    return c.json({ error: 'Position must be between 0 and 1' }, 400);
  }

  if (!['north', 'south', 'east', 'west', 'top'].includes(face)) {
    return c.json({ error: 'Invalid face' }, 400);
  }

  if (width <= 0 || height <= 0) {
    return c.json({ error: 'Width and height must be positive' }, 400);
  }

  try {
    // Check if building exists
    const building = await c.env.DB.prepare('SELECT url FROM websites WHERE url = ?')
      .bind(buildingUrl)
      .first<{ url: string }>();

    if (!building) {
      return c.json({ error: 'Building not found' }, 404);
    }

    // Check for overlapping billboards on the same face
    // For now, just check if there's already a billboard on this face
    // (Future: implement proper AABB collision detection)
    const existingBillboards = await c.env.DB.prepare(`
      SELECT id FROM billboards
      WHERE building_url = ? AND face = ?
    `)
      .bind(buildingUrl, face)
      .all<{ id: number }>();

    if (existingBillboards.results.length > 0) {
      return c.json({ error: 'Billboard already exists on this face' }, 409);
    }

    // Create billboard record
    const result = await c.env.DB.prepare(`
      INSERT INTO billboards
      (building_url, face, position_x, position_y, width, height, image_url, purchased_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        buildingUrl,
        face,
        positionX,
        positionY,
        width,
        height,
        imageUrl || '/billboards/test.svg',
        new Date().toISOString()
      )
      .run();

    return c.json({
      id: result.meta.last_row_id,
      buildingUrl,
      face,
      positionX,
      positionY,
      width,
      height,
      imageUrl: imageUrl || '/billboards/test.svg',
      message: 'Billboard created successfully. Navigate to payment to complete purchase.',
    });
  } catch (error) {
    console.error('Error creating billboard:', error);
    return c.json({ error: 'Failed to create billboard' }, 500);
  }
});

export default app;
