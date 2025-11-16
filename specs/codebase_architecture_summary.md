# 3D Neighborhood Codebase Architecture Summary

## Project Overview
**3D Neighborhood** is an interactive 3D web visualization of websites organized by semantic similarity. Users explore a procedurally generated world where each building represents a website, clustered together based on content similarity.

**Tech Stack:**
- Frontend: React + Three.js (R3F) for 3D visualization
- Backend: Hono (Cloudflare Workers) with SQLite (D1)
- Data Pipeline: Modal (scraping, embeddings, descriptions)
- Monorepo: Turborepo with 3 packages (client, server, shared)

---

## 1. DATABASE SCHEMA & STRUCTURE

### Location
`/packages/server/schema.sql`

### Core Tables

#### `websites` Table
- **Primary Key:** `url` (TEXT)
- **Fields:**
  - `title` - Website name
  - `description` - Content description
  - `embedding` - 384-dim embedding vector (stored as BLOB, Float32Array)
  - `embedding_dim` - Always 384 (future-proofing)
  - `popularity_score` - Numeric ranking (0-100)
  - `scraped_at` - ISO timestamp
- **Indexes:** `idx_websites_popularity` for fast sorting
- **Purpose:** Semantic embeddings drive k-NN similarity clustering

#### `placements` Table
- **Primary Key:** `url` (TEXT)
- **Fields:**
  - `chunk_x, chunk_z` - Chunk coordinates
  - `grid_x, grid_z` - Grid cell within chunk (0-4)
  - `world_x, world_z` - Actual world position with noise offset
  - `created_at` - Timestamp
- **Indexes:** 
  - `idx_placements_chunk` - Fast spatial queries
  - `idx_placements_created` - Timeline tracking
- **Purpose:** Tracks WHERE each website is placed in the world

#### `chunks` Table
- **Primary Key:** `(chunk_x, chunk_z)` composite
- **Fields:**
  - `data` - JSON blob of ChunkResponse (full building data)
  - `world_version` - Generation algorithm version
  - `generated_at` - Cache creation timestamp
- **Indexes:**
  - `idx_chunks_version` - Revalidation tracking
  - `idx_chunks_generated` - Cache freshness
- **Purpose:** Server-side chunk caching (deterministic generation)

### Coordinate System

**World Space:**
- X/Z axes are horizontal (top-down 2D plane)
- Y axis is vertical (building heights)
- Buildings positioned at `(worldX, height/2, worldZ)` (centered on ground)

**Chunk Layout:**
```
CHUNK_GRID_SIZE = 5          // 5x5 cells per chunk
CELL_SIZE = 30               // 30 units per cell
CHUNK_SIZE = 150             // 5 * 30 = 150 world units

Chunk coordinates → World coordinates:
  baseX = chunkX * 150
  baseZ = chunkZ * 150
  
Grid cell → World position:
  cellBaseX = baseX + gridX * 30
  cellBaseZ = baseZ + gridZ * 30
  actualWorldX = cellBaseX + offsetX  // ±8 units noise
  actualWorldZ = cellBaseZ + offsetZ
```

**Road Pattern:** Cross-shaped roads at `gridX == 2` OR `gridZ == 2`
- Creates 4 quadrants with 4x4 = 16 buildings per chunk
- 9 cells are roads (no buildings)

---

## 2. BUILDING RENDERING SYSTEM

### Three.js Components

#### `Building.tsx` Component
**Props:**
```typescript
interface BuildingProps {
  building: BuildingData;
  type?: BuildingType;  // NORMAL | NEW | ANCHOR | HIGHLIGHTED
}
```

**Rendering:**
- White box mesh with dimensions: `[width, height, width]`
- Position: `[worldX, height/2, worldZ]` (centered on ground)
- Colored wireframe edges based on `BuildingType`:
  - `NORMAL` → Black edges
  - `NEW` → Green edges (generated this session)
  - `ANCHOR` → Blue edges (seed buildings for future)
  - `HIGHLIGHTED` → Yellow edges (targeted/selected)

**Data Structure:**
```typescript
interface BuildingData {
  url: string;           // Website URL (identifier)
  gridX, gridZ: number;  // Grid position (0-4)
  worldX, worldZ: number; // Actual world coordinates
  width, height: number; // Box dimensions
}
```

#### `Chunk.tsx` Component
- Renders all buildings in a chunk
- Sets `BuildingType.NEW` for cache misses (green outlines)
- Uses key pattern: `${chunkX}-${chunkZ}-${index}`

#### `Scene.tsx` Component (Liminal Aesthetic)
- **Fog:** White fog from 150-300 units (creates ethereal effect)
- **Background:** White color (matches fog)
- **Lighting:** Ambient only (1.0 intensity) - no shadows
- **Ground:** Large 2000x2000 white plane
- **Purpose:** Creates "liminal space" (empty mall-like aesthetic)

### Rendering Pipeline

```
World (chunk manager)
  ↓
useChunks hook (fetch from API)
  ↓
Chunk component (per chunk)
  ↓
Building component (per building)
  ↓
Three.js Mesh (white box + wireframe edges)
  ↓
Three.js Scene (fog, lighting, ground)
```

---

## 3. USER INTERACTION PATTERNS

### Player Controller (`Player.tsx`)

**Input:**
- **WASD:** Movement (camera-relative)
- **Mouse:** Look around (PointerLockControls)
- **ESC:** Unlock pointer
- **Click:** Lock pointer

**Movement System:**
- Speed: 50 units/second
- Eye height: 1.6 units (fixed)
- Velocity-based physics (frame delta)
- Direction vectors: forward/right relative to camera

**Collision Detection:**
```typescript
// AABB (Axis-Aligned Bounding Box) collision
for each building:
  halfWidth = building.width / 2
  minX = building.worldX - halfWidth
  maxX = building.worldX + halfWidth
  // Circle-to-AABB test (player radius = 3)
  closestX = clamp(playerX, minX, maxX)
  distance = hypot(playerX - closestX, playerZ - closestZ)
  if distance < 3: COLLISION
```

**Raycast Targeting:**
- Throttled to 150ms (not every frame)
- Raycasts from camera center forward
- Finds first building hit and matches via position delta
- Emits `onTargetChange` callback (used for info panel)

**Callbacks:**
- `onPositionChange(x, y, z)` - Drives chunk loading
- `onRotationChange(yaw)` - Minimap compass
- `onTargetChange(building)` - Info panel update

**Noclip Mode:**
- Optional bypass of collision detection
- Useful for testing/dev

### Spawn Position Logic

**Safe Spawn Finding:**
```
Search 21x21 grid in 20-unit increments
For each test position:
  Check collision with all loaded buildings
  If no collision → use it
If no safe position found → fallback to (200, 1.6, 200)
```

**Entry Point Spawning** (for direct website jumps):
- Calculate closest road to building (vertical = gridX==2, horizontal = gridZ==2)
- Spawn on road center, aligned with building
- Look-at building center
- Distance ensures clean view

---

## 4. CLIENT-SERVER ARCHITECTURE & API

### API Base URL Resolution
```typescript
// Priority:
1. import.meta.env.VITE_API_URL (environment variable)
2. /api (Vite dev proxy)
3. Production: Cloudflare Workers endpoint
```

### API Endpoints

#### `GET /health`
Health check for database readiness
```json
Response: { status: 'ok', timestamp: ISO string }
```

#### `GET /api/websites?q=<query>`
Website autocomplete search
```typescript
Query: Minimum 2 characters
Returns: Array<{ url, title, favicon }>
// Searches URL and title (case-insensitive)
// Orders by popularity_score DESC
// Limit: 10 results
```

#### `POST /api/entry-point`
Get spawn location for a specific website
```typescript
Request: { url: string }
Response: {
  chunkX, chunkZ: number;         // Which chunk
  buildingIndex: number;          // Building position
  spawnX, spawnY, spawnZ: number; // Camera position
  lookAtX, lookAtY, lookAtZ: number; // Target
}
```

**Logic:**
1. Check if URL exists in database
2. Search all chunks for placement
3. If found: calculate road spawn point (closer of 2 roads)
4. If not found: generate new island chunk with URL as anchor
   - Picks random chunk coords far from origin (-10 to 10)
   - Uses k-NN to find similar websites
   - Places anchor URL in first available cell
   - Caches chunk for next requests

#### `GET /api/chunks/:cx/:cz`
Fetch or generate chunk data
```typescript
Response: ChunkResponse {
  chunkX, chunkZ: number;
  worldVersion: number;           // Algorithm version
  buildings: Array<BuildingData>; // 16 buildings (roads omitted)
}
// Header: X-Chunk-Cache-Status: 'hit' | 'miss'
```

**Generation Logic:**
1. Check D1 cache first (hit = return immediately)
2. If miss: generate new chunk
   - Get anchor URLs from 8 adjacent chunks
   - Query k-NN for 5 random adjacent buildings
   - Get 10 similar sites per anchor (50 max total)
   - Flatten & deduplicate candidates
   - Fallback: use random seed if no adjacent chunks
3. Deterministic RNG ensures same chunk always generates same way
4. Cache result in D1 for future requests

#### `GET /api/stats`
World statistics for UI
```typescript
Response: {
  totalWebsites: number;  // In database
  placedWebsites: number; // In placements table
  totalChunks: number;    // Generated chunks
  chunkBounds: { minX, maxX, minZ, maxZ };
  chunkCoords: Array<[chunkX, chunkZ]>; // For minimap
}
```

### Response Type Definitions

```typescript
// Shared API types (packages/shared/src/api.ts)

interface ChunkResponse {
  chunkX, chunkZ: number;
  worldVersion: number;
  buildings: BuildingData[];
}

interface EntryPointResponse {
  chunkX, chunkZ: number;
  buildingIndex: number;
  spawnX, spawnY, spawnZ: number;
  lookAtX, lookAtY, lookAtZ: number;
}

interface StatsResponse {
  totalWebsites: number;
  placedWebsites: number;
  totalChunks: number;
  chunkBounds: ChunkBounds;
  chunkCoords: Array<[number, number]>;
}
```

---

## 5. CHUNK LOADING & MANAGEMENT

### Client-Side Chunk Loading (`useChunks` Hook)

**State Management:**
```typescript
const [chunkMap, setChunkMap] = useState<Map<string, ChunkResponse>>();
const loadedChunks = useRef<Set<string>>();      // Already loaded
const isLoadingChunk = useRef<Set<string>>();    // In progress
```

**Initial Load (on spawn):**
1. Convert spawn position to chunk coordinates
2. Load 3x3 grid centered on spawn chunk
3. Parallel Promise.all for all 9 chunks

**Dynamic Load (on player move):**
- Tracks `playerPosition` (from Player component)
- Whenever player enters new chunk: load 3x3 around new chunk
- Prevents duplicate loads with `loadedChunks` set
- TODO: Unload distant chunks (current: keep all loaded)

**Chunk Key Format:** `${chunkX},${chunkZ}`

**Cache Status Tracking:**
- `onChunkLoaded` callback receives `'hit'` or `'miss'`
- Cache miss → mark chunk as NEW (green edges)
- Used to track exploration progress

### Server-Side Chunk Caching

**Cache-First Strategy:**
```
1. Query chunks table (chunk_x, chunk_z)
2. If cached: return immediately (set header: X-Chunk-Cache-Status: hit)
3. If not cached:
   a. Generate chunk deterministically
   b. Record all building placements
   c. Insert into chunks table
   d. Return (set header: X-Chunk-Cache-Status: miss)
```

**Deterministic Generation:**
```typescript
// Same inputs → same outputs (pure function)
const seed = (cx * 73856093) ^ (cz * 19349663);
// All RNG seeded from chunk coords
// No external randomness → reproducible world
```

---

## 6. SEMANTIC CLUSTERING (k-NN)

### k-NN Implementation (`packages/server/src/knn.ts`)

**Two Modes:**
1. **Mock Mode** (USE_MOCK_KNN = true)
   - Returns random unplaced websites
   - Used for testing without real embeddings
   
2. **Real Mode** (USE_MOCK_KNN = false)
   - Cosine similarity on embedding vectors
   - In-memory search (548 sites = ~850KB)

**Cosine Similarity:**
```
similarity = dot(A, B) / (magnitude(A) * magnitude(B))
```

**Real k-NN Process:**
1. Fetch anchor embedding from DB
2. Load all website embeddings into memory (cached)
3. Compute similarity to all others
4. Sort by similarity (descending)
5. Return top-k URLs

**Integration Points:**
- `findSimilarWebsites(db, anchorUrl, k)` → Array<string>
- Used during chunk generation for candidate selection
- Capped at 5 anchors max per chunk (prevents slowdown)
- Returns 10 similar sites per anchor (50 total max)

**Scalability Note:**
- Current: 548 sites works fine in-memory (~850KB)
- Future: 1M+ sites needs Cloudflare Vectorize (indexed search)

---

## 7. CLOUDFLARE INTEGRATION

### Wrangler Configuration (`packages/server/wrangler.toml`)

```toml
name = "3d-neighborhood-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "neighborhood-db"
database_id = "7b6b4fff-9203-4c1b-91c9-adac51db1e81"

[env.local]  # Development environment config
```

### Services in Use

**1. Cloudflare Workers**
- Runtime for Hono API
- Serverless compute for chunk generation
- Supports D1 bindings

**2. Cloudflare D1 (SQLite)**
- Database binding: `c.env.DB`
- Tables: websites, placements, chunks
- Prepared statements with `.prepare().bind()`
- Batch operations: `db.batch(statements)`

**3. CORS Middleware**
```typescript
app.use('/*', cors());  // Enable cross-origin requests
```

### Database Access Pattern

```typescript
type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// In handlers:
const result = await c.env.DB
  .prepare('SELECT * FROM websites WHERE url = ?')
  .bind(url)
  .first<{ url: string }>();
```

### Local Development

- Wrangler CLI: `wrangler dev`
- Miniflare emulator for local D1
- Schema initialization via `schema.sql`

---

## 8. WORLD CONFIGURATION

### Config System (`packages/shared/src/config.ts`)

```typescript
export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  // Generation
  worldSeed: 42,
  worldVersion: 1,

  // Chunk layout
  chunkGridSize: 5,           // 5x5 cells
  cellSize: 30,               // Units per cell
  buildingsPerChunk: 16,      // 4x4 (excluding roads)

  // Noise
  noiseScale: 0.1,
  maxPositionOffset: 8,       // ±8 units from grid center

  // Building size
  baseWidth: 15,              // Units
  baseHeight: 25,
  maxWidth: 28,
  maxHeight: 120,
  sizeNoiseVariation: 0.2,    // ±20%

  // k-NN
  knnPerAnchor: 15,
  maxAnchorsPerChunk: 3,

  // Rendering
  fogStart: 150,
  fogEnd: 300,
  chunkLoadRadius: 1,         // Load 3x3 (1 in each direction)
  wireframeLineWidth: 4,      // Building edge width

  // Multiplayer (future)
  positionUpdateIntervalMs: 1000, // 1 Hz
}
```

### Noise System (`packages/shared/src/noise.ts`)

**Seeded Random:**
```typescript
const rng = createSeededRandom(seed);
const value = rng(); // 0.0 to 1.0
```

**Position Offset:**
- Hash chunk coords + world seed
- Generate Perlin-like noise
- Apply to grid center (±8 units)
- Creates organic placement variation

**Size Variation:**
- URL-based popularity mock
- Noise-scaled ±20% around base
- Popular sites get taller buildings

---

## 9. CLIENT ARCHITECTURE

### React Component Hierarchy

```
App.tsx
├── StartScreen (initial UI)
└── Canvas (R3F scene)
    ├── Scene (fog, lighting, ground)
    ├── World (chunk manager)
    │   └── Chunk[] (per chunk)
    │       └── Building[] (per building)
    └── Player (camera/controls)

UI Overlays:
├── StatsPanel (world stats)
├── DebugPanel (dev tools)
├── Minimap (world view + compass)
└── InfoPanel (targeted building info)
```

### State Management

**React Hooks:**
- `useChunks` - Chunk loading & caching
- `useNewChunks` - Session-new tracking
- `usePlayerPosition` - Position tracking
- `useQuery` - TanStack Query for data fetching

**Props Drilling:**
- Player position → chunk loading
- Building data → collision detection
- Target building → info panel

---

## 10. DEVELOPMENT WORKFLOW

### Package Scripts (from `package.json` patterns)

```bash
# Database
npm run db:reset              # Fresh schema
npm run db:seed-test          # 15 test websites
npm run db:import-local       # From data pipeline
npm run db:pull-production    # 548 real websites

# Development
npm run dev                   # Start dev server
npm run build                 # Build for production
npm run type-check            # TypeScript validation

# Cloudflare
npm run deploy                # Deploy to workers
```

### Development Environment

**Client (Vite):**
- Port: 5173
- Proxy: /api → localhost:8787
- HMR enabled

**Server (Wrangler):**
- Port: 8787
- D1 emulator (Miniflare)
- Schema loaded from `schema.sql`

---

## Summary of Key Systems

| System | Purpose | Tech |
|--------|---------|------|
| **Rendering** | 3D visualization of buildings | Three.js + R3F |
| **Chunk Generation** | Deterministic world creation | Seeded RNG + k-NN |
| **Caching** | Fast chunk access | D1 SQLite |
| **k-NN Search** | Semantic similarity | Embeddings + cosine |
| **Movement** | Player navigation | WASD + collision |
| **Targeting** | Building interaction | Raycasting (150ms throttle) |
| **Networking** | Client-server communication | Hono REST API |
| **Deployment** | Serverless hosting | Cloudflare Workers + D1 |

---

## Performance Notes

- **Chunk Generation:** ~1-5ms (deterministic + cached)
- **k-NN Search:** ~50ms (50 anchors × 10 sites = 500 dots)
- **Memory:** 548 websites embeddings = ~850KB
- **Chunk Load Radius:** 3×3 = 9 chunks (4,096 buildings)
- **Rendering:** Fog culling beyond 300 units

**Bottlenecks:**
- k-NN on 1M+ sites needs Vectorize (indexed search)
- Chunk generation grows O(anchors × k-NN complexity)
- Client-side raycast can skip buildings if throttle too high

