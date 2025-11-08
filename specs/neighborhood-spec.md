# 3D Neighborhood Website - Project Specification

**Version**: 0.3  
**Last Updated**: 2025-10-26  
**Status**: Design Phase

---

## 1. Project Vision

A shared, explorable 3D neighborhood where websites are represented as buildings, spatially organized by semantic similarity. Users navigate a progressively-generated world that expands based on their exploration.

**Core Principles**:
- Users build the map through exploration (first to explore = first to generate)
- Semantic similarity determines spatial proximity
- Simple, modular architecture suitable for iterative development
- Global shared persistent world
- **Deterministic generation**: Same inputs always produce same outputs

---

## 2. Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Language** | TypeScript | Type safety throughout stack |
| **Client** | React + @react-three/fiber | Component-based UI, Three.js integration |
| **Server** | Hono on Cloudflare Workers | Edge deployment, simple scaling |
| **Database** | Cloudflare D1 (SQLite) | JSON blob cache per chunk |
| **Vector Search** | Mock (hash-based) → Vectorize later | Defer complexity until generation logic stable |
| **Real-time** | HTTP polling (1-2 Hz) → Durable Objects later | Soft real-time until world is stable |
| **Deployment** | Cloudflare Pages + Workers | One-command deploy, global CDN |

**Deployment Philosophy**: Simple `npm run deploy` → live globally

**Progressive Deployment Path**:
1. **Phase 1**: Workers (API) + Pages (static client)
2. **Phase 2**: Add D1 for chunk caching
3. **Phase 3**: Integrate real vector search (Vectorize)
4. **Phase 4**: Add Durable Objects for concurrent multiplayer

---

## 3. Map & Coordinate System

### 3.1 Grid-Based Layout with Organic Variation

**Concept**: Buildings snap to a grid, but use noise to offset their exact position within each cell, creating an imperfect neighborhood feel.

**Grid Structure**:
- **Cell size**: 30 units (one building per cell)
- **Chunk size**: 5×5 cells (4×4 buildings + roads) = 150×150 units
- **Max position offset**: ±8 units from grid center
- **Noise function**: Perlin/Simplex (deterministic, seeded by URL)

**Coordinate System**:
- World space: Continuous (X, Y, Z) coordinates
- Chunk indexing: Integer grid (cx, cz)
- Origin (0, 0): Set by first user's entry URL

### 3.2 Deterministic Generation

**Core Principle**: Generation is a pure function

```typescript
function generateChunk(cx: number, cz: number, worldSeed: number): ChunkData {
  // Pure function - no database queries, no external state
  // Same inputs ALWAYS produce same output
  // Can run client-side, server-side, or offline
}
```

**Benefits**:
- Testable in isolation
- Reproducible for debugging
- Can regenerate world with different seeds
- Server just caches results (doesn't own logic)

**Implementation Notes**:
- All generation logic lives in `packages/shared/generation.ts`
- Uses deterministic RNG seeded by `(cx, cz, worldSeed)`
- No database queries during generation
- No external API calls during generation

### 3.3 Layout Algorithm

```
Generate Chunk (cx, cz, worldSeed):
├─ Seed RNG with hash(cx, cz, worldSeed)
├─ Create 5×5 grid
├─ Determine road cells (procedural, no storage)
│   └─ Roads = visual gaps in rendering, not stored data
├─ For each building cell:
│   ├─ Calculate grid position
│   ├─ Apply noise offset (deterministic from cell coords)
│   ├─ Select website using mock similarity:
│   │   └─ hash(anchor_url, cell_position, worldSeed) → website_id
│   ├─ Calculate building size (popularity + noise)
│   └─ Add to ChunkData
└─ Return ChunkData (pure JSON, ready to cache)
```

**Key Simplifications**:
- **Roads**: Procedural visual gaps, not stored data
- **Mock Vector Search**: Hash-based similarity until real embeddings ready
- **No global registry needed**: Determinism prevents duplicates naturally

### 3.4 Building Size System

**Progressive Scaling with Hard Caps**:
```
base_size + (log_scale(popularity) * multiplier) + noise_variation

Constraints:
- Width: 15-28 units (fits in 30-unit cell)
- Height: 25-120 units (visual cap)
- Noise variation: ±20%
```

**Popularity Score Sources** (scraped separately):
- Traffic estimates (SimilarWeb, Alexa)
- Domain age
- Backlink count
- Social mentions

### 3.5 View Distance & Fog

**Purpose**: Reduce rendering, hide ungenerated chunks, create atmosphere

**Parameters**:
- Fog start: 150 units
- Fog end: 300 units (full opacity)
- Chunk loading distance: 3×3 chunks (9 total)
- Effective visible buildings: ~144 buildings (16 per chunk × 9)

---

## 4. Data Architecture

### 4.1 Simplified Database Schema (D1 / SQLite)

**Philosophy**: Database is a cache, not source of truth. Generation logic is source of truth.

```sql
-- Chunks: Cached generated chunk data (JSON blob)
CREATE TABLE chunks (
  chunk_x INTEGER NOT NULL,
  chunk_z INTEGER NOT NULL,
  data JSON NOT NULL,              -- Full ChunkData as JSON
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generator_user_id TEXT,
  world_version INTEGER NOT NULL,  -- For generation algorithm versioning
  PRIMARY KEY (chunk_x, chunk_z)
);

-- Buildings: Unified table (no separate placed_buildings)
CREATE TABLE buildings (
  url TEXT NOT NULL,
  chunk_x INTEGER NOT NULL,
  chunk_z INTEGER NOT NULL,
  grid_x INTEGER NOT NULL,
  grid_z INTEGER NOT NULL,
  world_x REAL NOT NULL,
  world_z REAL NOT NULL,
  metadata JSON NOT NULL,          -- {width, height, title, etc}
  placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (url, chunk_x, chunk_z)
);

CREATE INDEX idx_building_chunk ON buildings(chunk_x, chunk_z);
CREATE INDEX idx_building_position ON buildings(world_x, world_z);

-- Website metadata (scraped data)
CREATE TABLE websites (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  popularity_score REAL DEFAULT 0,
  embedding_dim INTEGER,           -- Future-proof for model changes
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- World configuration
CREATE TABLE world_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Store: world_seed, world_version, embedding_model, etc.
```

**Rationale for Unified Schema**:
- Single source of building data (no sync between tables)
- Simpler queries (no joins)
- Easy to migrate/re-seed world
- Buildings table is redundant denormalization of chunks.data (for querying)

### 4.2 Chunk Data Structure

```typescript
interface ChunkData {
  chunkX: number;
  chunkZ: number;
  worldVersion: number;           // Generation algorithm version
  buildings: Array<{
    url: string;
    gridX: number;                // Grid cell (0-4)
    gridZ: number;
    worldX: number;               // Actual position with noise
    worldZ: number;
    width: number;
    height: number;
  }>;
  // Roads are NOT stored - computed procedurally during rendering
}
```

**Serialization**: Direct JSON.stringify/parse, no transformation needed

### 4.3 Mock Vector Search (Early Phase)

**Purpose**: Implement all generation logic without external dependencies

```typescript
// Deterministic similarity using hash
function findSimilarWebsites(anchorUrl: string, k: number, seed: number): string[] {
  const websites = MOCK_WEBSITE_LIST; // Static list for dev
  
  return websites
    .map(url => ({
      url,
      similarity: deterministicHash(anchorUrl + url + seed)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .map(w => w.url);
}
```

**Migration Path**: Later swap for real Vectorize queries, generation logic unchanged

### 4.4 Real Vector Search (Later Phase)

**Cloudflare Vectorize Integration**:
- Embedding dimensions: Stored in `websites.embedding_dim` (e.g., 384 or 768)
- Metric: Cosine similarity
- k-NN query size: 5-15 neighbors

**Future-Proofing**: Can upgrade embedding model without schema migration

---

## 5. World Generation

### 5.1 Deterministic Generation Principles

**Pure Function Architecture**:
```typescript
// packages/shared/generation.ts
export function generateChunk(
  cx: number,
  cz: number,
  config: WorldConfig
): ChunkData {
  // No database queries
  // No external API calls
  // No mutable global state
  // Deterministic RNG only
  
  const seed = hashCoords(cx, cz, config.worldSeed);
  const rng = seededRandom(seed);
  
  // ... generation logic ...
  
  return chunkData;
}

interface WorldConfig {
  worldSeed: number;
  worldVersion: number;
  chunkSize: number;
  cellSize: number;
  // ... other config ...
}
```

**Benefits**:
- Can test generation locally without database
- Can regenerate entire world by changing seed
- Can benchmark different algorithms
- Server is stateless (just caches results)

### 5.2 Noise Library (Shared)

**Location**: `packages/shared/noise.ts`

**Contents**:
- Perlin/Simplex implementation
- Seeded RNG
- Coordinate hashing utilities
- Building placement helpers

**Usage**: Both client and server import from shared package

**Ensures**: Perfect visual determinism between client previews and server generation

### 5.3 Entry Point System

```
User enters URL:
├─ Look up URL in buildings table
│   ├─ Found: Spawn at existing building
│   └─ Not found:
│       ├─ Is world empty (no chunks)?
│       │   ├─ YES: Place at origin (0,0)
│       │   └─ NO: Find chunk with space using mock similarity
│       ├─ Generate chunk if needed (cache result)
│       └─ Spawn player at building entrance
```

### 5.4 World Versioning

**Seed Configuration**:
```typescript
interface WorldConfig {
  worldSeed: number;        // Master seed (set once at world creation)
  worldVersion: number;     // Algorithm version (increment on changes)
  generationParams: {
    chunkSize: number;
    cellSize: number;
    noiseScale: number;
    // ... other tunable params
  };
}
```

**Version Strategy**:
- Old chunks keep their version
- New chunks use latest version
- Can coexist in same world
- Enables gradual algorithm improvements

---

## 6. Client Architecture

### 6.1 Component Structure (React + Three.js)

```
/client/src
├─ main.tsx              # Entry point
├─ App.tsx               # Root component
├─ components/
│   ├─ World.tsx         # Three.js scene container
│   ├─ Building.tsx      # Individual building (uses shared noise)
│   ├─ Player.tsx        # Player controller (WASD movement)
│   └─ UI/
│       ├─ URLEntry.tsx  # Entry point interface
│       └─ BuildingInfo.tsx  # Hover/click building details
├─ hooks/
│   ├─ useChunks.ts      # Chunk loading with IndexedDB cache
│   ├─ usePlayerSync.ts  # Polling-based position sync (1-2 Hz)
│   └─ usePlayer.ts      # Local player state
└─ types.ts              # Shared types (re-export from packages/shared)
```

### 6.2 Client-Side Chunk Cache

**Strategy**: Cache `ChunkData` in IndexedDB

```typescript
// useChunks.ts
const chunkCache = {
  async get(cx: number, cz: number, version: number): Promise<ChunkData | null> {
    // Check IndexedDB first
    const cached = await idb.get(`chunk:${cx},${cz}:v${version}`);
    if (cached) return cached;
    
    // Fetch from server
    const data = await fetch(`/api/chunks/${cx}/${cz}`).then(r => r.json());
    
    // Cache for next time
    await idb.set(`chunk:${cx},${cz}:v${version}`, data);
    
    return data;
  }
};
```

**Benefits**:
- Reduces Worker API calls
- Enables offline exploration
- Instant chunk loading on revisit

### 6.3 Rendering Strategy

**Visual Determinism First**:
- Buildings derive appearance from `url` hash + noise
- No random visual variety until determinism works
- Same URL looks identical everywhere
- Simplifies debugging chunk sync issues

**Procedural Details** (client-side only):
```typescript
function Building({ url, position, size }: BuildingProps) {
  // Deterministic visual variations using shared noise lib
  const seed = hashString(url);
  const windowPattern = generateWindows(seed);
  const color = generateColor(seed);
  
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
      {/* Windows, details, etc. */}
    </mesh>
  );
}
```

**Roads**: Not stored, computed during render based on grid position

### 6.4 Key Libraries

- `@react-three/fiber`: React renderer for Three.js
- `@react-three/drei`: Camera controls, helpers
- `zustand`: Lightweight state management
- `idb-keyval`: Simple IndexedDB wrapper for chunk cache

---

## 7. Server Architecture

### 7.1 Simplified Multiplayer (Phase 1: Soft Real-Time)

**Strategy**: HTTP polling instead of WebSockets initially

```typescript
// Client polls every 500ms - 1000ms
setInterval(async () => {
  const nearbyPlayers = await fetch('/api/players/nearby', {
    method: 'POST',
    body: JSON.stringify({ x: playerX, z: playerZ })
  }).then(r => r.json());
  
  updateOtherPlayers(nearbyPlayers);
}, 1000);
```

**Server Endpoint**:
```typescript
app.post('/api/players/nearby', async (c) => {
  const { x, z } = await c.req.json();
  
  // Update this player's position in ephemeral store (KV with TTL)
  await c.env.KV.put(`player:${playerId}`, JSON.stringify({ x, z }), {
    expirationTtl: 60 // Auto-cleanup inactive players
  });
  
  // Return nearby players (spatial query)
  const nearby = await getNearbyPlayers(x, z, radius);
  return c.json(nearby);
});
```

**Benefits**:
- No Durable Objects needed initially
- Simple to implement and debug
- Client interpolation makes 1-2 Hz feel smooth
- Easy to upgrade to WebSockets later

**Client-Side Interpolation**:
- Smooth position updates between polls
- Predictive movement
- Makes low update rate feel responsive

### 7.2 API Structure (Hono)

```typescript
// src/index.ts
const app = new Hono<{ Bindings: Env }>();

// Chunk API (generation + caching)
app.get('/api/chunks/:cx/:cz', async (c) => {
  const { cx, cz } = c.req.param();
  
  // Check D1 cache
  const cached = await c.env.DB.prepare(
    'SELECT data FROM chunks WHERE chunk_x = ? AND chunk_z = ?'
  ).bind(cx, cz).first();
  
  if (cached) return c.json(cached.data);
  
  // Generate (pure function from shared package)
  const config = await getWorldConfig(c.env.DB);
  const chunkData = generateChunk(Number(cx), Number(cz), config);
  
  // Cache in D1
  await c.env.DB.prepare(
    'INSERT INTO chunks (chunk_x, chunk_z, data, world_version) VALUES (?, ?, ?, ?)'
  ).bind(cx, cz, JSON.stringify(chunkData), config.worldVersion).run();
  
  return c.json(chunkData);
});

// Player position sync (soft real-time)
app.post('/api/players/update', playerUpdateHandler);
app.post('/api/players/nearby', nearbyPlayersHandler);

// Entry point
app.post('/api/enter', entryPointHandler);
```

### 7.3 Component Responsibilities

**Workers (Stateless)**:
- Serve chunk data (cached or generated)
- Handle player position updates (via KV)
- Query nearby players
- Serve website metadata

**D1 (Cache)**:
- Store generated chunks (JSON blobs)
- Store website metadata
- Store world configuration

**KV (Ephemeral State)**:
- Player positions (TTL: 60s)
- Active player list

**Durable Objects** (Phase 4 - Later):
- Real-time WebSocket connections
- Sub-second position updates
- Concurrent player interactions

---

## 8. Data Collection Pipeline

### 8.1 Decoupled Scraping

**Philosophy**: Scraping is a separate system that outputs normalized data

**Architecture**:
```
Scraper (separate repo/package)
  ↓ outputs JSON + embeddings
R2 Bucket (or S3)
  ↓ ingested by
Worker (scheduled import job)
  ↓ writes to
D1 (websites table)
```

**Benefits**:
- Server never does scraping (no timeouts, no rate limits)
- Can iterate on scraping separately
- Can backfill data without touching server
- Easy to swap data sources

### 8.2 Scraper Output Format

```json
{
  "url": "nytimes.com",
  "title": "The New York Times",
  "description": "Breaking news, analysis, and opinion...",
  "popularity_score": 95.2,
  "embedding": [0.123, -0.456, ...],  // 384 or 768 dims
  "embedding_model": "all-MiniLM-L6-v2",
  "embedding_dim": 384,
  "scraped_at": "2025-10-26T12:00:00Z"
}
```

### 8.3 Import Job (Scheduled Worker)

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Fetch new scraped data from R2
    const files = await env.R2_BUCKET.list({ prefix: 'scraped/' });
    
    for (const file of files.objects) {
      const data = await env.R2_BUCKET.get(file.key);
      const websites = await data.json();
      
      // Bulk insert into D1
      await bulkInsertWebsites(env.DB, websites);
      
      // Upload embeddings to Vectorize (when ready)
      // await env.VECTORIZE.upsert(websites);
      
      // Archive processed file
      await env.R2_BUCKET.put(`processed/${file.key}`, data);
      await env.R2_BUCKET.delete(file.key);
    }
  }
};
```

### 8.4 Embedding Strategy

**Early Phase (Mock)**:
- No real embeddings
- Hash-based similarity for testing
- Focus on generation logic

**Later Phase (Real)**:
- Model: `all-MiniLM-L6-v2` (384-dim) or similar
- Store `embedding_dim` in DB for flexibility
- Can upgrade model without schema changes
- Generate embeddings offline (scraper outputs them)

---

## 9. Multiplayer & Real-time

### 9.1 Soft Real-Time (Phase 1)

**Update Frequency**: 1-2 Hz (500ms - 1000ms polling)

**Player State**:
```typescript
interface PlayerState {
  id: string;
  x: number;
  z: number;
  rotation: number;  // Y-axis rotation only
  timestamp: number;
}
```

**Client Interpolation**:
- Linear interpolation between updates
- Simple dead reckoning (continue last velocity)
- Smooth out jitter

**Perceived Smoothness**:
- Client-side interpolation makes 1-2 Hz feel like 30+ Hz
- Good enough for casual exploration (not competitive gameplay)

### 9.2 Hard Real-Time (Phase 4 - Later)

**Durable Objects Integration**:
- One DO per spatial region or player cluster
- WebSocket connections for sub-100ms updates
- 30-60 Hz position updates
- Concurrent player interactions

**Only add when**:
- Basic world exploration works perfectly
- Visual rendering is polished
- Need true real-time interactions

---

## 10. Open Design Questions

### Map & Generation
- [x] Road pattern: **Procedural visual gaps** (not stored)
- [ ] Noise function: Perlin, Simplex, or simple hash?
- [ ] k-NN value: How many neighbors per anchor (5, 10, 15)?
- [x] Chunk loading: **3×3 visible chunks** (9 total, ~144 buildings)

### Rendering
- [x] Building visual style: **Pure cubes initially**, deterministic variations later
- [ ] Ground texture: Procedural or tiled?
- [ ] Skybox: Simple gradient or detailed?

### Data Collection
- [ ] Initial dataset: Top 1000 sites, or start empty?
- [ ] Scraping frequency: On-demand, daily, weekly?
- [ ] Embedding model: `all-MiniLM-L6-v2` (384-dim)?

### Multiplayer
- [ ] Authentication: Anonymous or accounts?
- [x] Player avatars: **Yes, visible to others** (simple geometry)
- [x] Update rate: **1-2 Hz initially** (polling), 30-60 Hz later (WebSocket)
- [ ] Avatar representation: Cubes, cylinders, or simple humanoid?

### Performance
- [ ] LOD (Level of Detail): Simplify distant buildings?
- [ ] Instancing: Use for repeated building geometry?
- [x] Client-side caching: **Yes, IndexedDB** for chunks

---

## 11. Implementation Phases

### Phase 1: Core Visualization (Local Dev)
- [ ] Basic Three.js scene with cube buildings
- [ ] Grid-based positioning with noise (using shared lib)
- [ ] Fog rendering
- [ ] WASD player movement
- [ ] Deterministic building generation (pure function)
- [ ] **No server needed** - all generation runs client-side

### Phase 2: Server Foundation
- [ ] Cloudflare Workers + D1 setup
- [ ] Chunk API (generation + caching)
- [ ] World config storage
- [ ] Deploy to Cloudflare Pages + Workers

### Phase 3: Client-Server Integration
- [ ] Fetch chunks from server API
- [ ] IndexedDB chunk caching
- [ ] Entry point system (spawn at URL)
- [ ] Basic player position sync (polling)

### Phase 4: Real Data (Decoupled)
- [ ] Separate scraping script
- [ ] R2 bucket setup
- [ ] Scheduled import worker
- [ ] Website metadata in D1

### Phase 5: Real Vector Search
- [ ] Vectorize integration
- [ ] Replace mock similarity with real k-NN
- [ ] Re-generate world with new algorithm (bump version)

### Phase 6: Hard Real-Time Multiplayer
- [ ] Durable Objects setup
- [ ] WebSocket connections
- [ ] 30-60 Hz position updates
- [ ] Player avatars with smooth interpolation

### Phase 7: Polish
- [ ] Building visual variety (deterministic)
- [ ] UI/UX improvements
- [ ] Performance optimization (instancing, LOD)

---

## 12. Project File Structure

```
/
├─ packages/
│   ├─ shared/                    # Shared between client & server
│   │   ├─ generation.ts          # Pure chunk generation logic
│   │   ├─ noise.ts               # Perlin/Simplex, seeded RNG
│   │   ├─ types.ts               # Shared TypeScript types
│   │   └─ config.ts              # World configuration constants
│   │
│   ├─ client/                    # React app
│   │   ├─ src/
│   │   │   ├─ components/
│   │   │   │   ├─ World.tsx
│   │   │   │   ├─ Building.tsx
│   │   │   │   └─ Player.tsx
│   │   │   ├─ hooks/
│   │   │   │   ├─ useChunks.ts   # IndexedDB cache
│   │   │   │   └─ usePlayerSync.ts
│   │   │   └─ main.tsx
│   │   └─ vite.config.ts
│   │
│   └─ server/                    # Cloudflare Workers
│       ├─ src/
│       │   ├─ index.ts           # Hono app (chunk API)
│       │   ├─ handlers/
│       │   │   ├─ chunks.ts
│       │   │   └─ players.ts
│       │   └─ durable-objects/   # (Phase 4)
│       │       └─ GameServer.ts
│       └─ wrangler.toml
│
├─ scripts/
│   ├─ scraper/                   # Separate scraping system
│   │   ├─ scrape.ts
│   │   └─ embed.ts
│   └─ seed-world.ts              # Initialize world config
│
└─ package.json                   # Root workspace
```

---

## 13. Architecture Principles

### Separation of Concerns
1. **Generation = Pure Function**: No side effects, fully deterministic
2. **Persistence = Cache**: Database stores results, not logic
3. **Rendering = Client-Side**: Server sends minimal data, client adds detail
4. **Scraping = External Pipeline**: Decoupled data collection

### Determinism Everywhere
- Same chunk coordinates → same buildings
- Same URL → same appearance
- Same seed → same world
- Reproducible for debugging and testing

### Progressive Complexity
- Start simple (mock data, polling, cubes)
- Add realism incrementally (real embeddings, WebSockets, detail)
- Each phase is independently deployable

### Future-Proof Design
- World versioning for algorithm changes
- Embedding dimension stored in DB
- Config-driven generation parameters
- Easy to re-seed entire world

---

## Notes & Decisions Log

**2025-10-26 (Morning)**:
- Decided on grid + noise approach (vs pure force-directed)
- Chose Cloudflare stack for simple deployment
- SQLite (D1) for structured data, Vectorize for embeddings
- React preferred over vanilla JS for client

**2025-10-26 (Afternoon)**:
- **Major refactor**: Generation is now pure function (deterministic)
- Unified building schema (no separate placed_buildings table)
- Defer Durable Objects until Phase 4 (use polling first)
- Client-side chunk caching (IndexedDB)
- Roads are procedural (not stored)
- Mock vector search until embeddings ready
- Scraping is decoupled pipeline (separate from server runtime)
- World versioning for algorithm iteration
- Visual determinism before visual fidelity

