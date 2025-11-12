# 3D Neighborhood - Implementation Progress

**Started**: 2025-11-08
**Current Phase**: Phase 4 - Mall System Polish
**Status**: ✅ Phase 0, 1, 2 & 3 COMPLETE - Full stack working with real data!
**Focus**: Iterating on the mall experience with mock/existing data before scaling KNN

---

## About This Document

This is a **living implementation log** that tracks:
- What has been built and tested
- Issues encountered and how they were fixed
- Current status and next steps
- Questions and decisions for future work

**For LLM Context**: The `/specs` directory (if it exists) contains design documents from the user and outside sources. Those documents represent fully iterated design decisions and should be treated as authoritative for overall project direction. When in doubt, refer to specs for architectural guidance.

---

## Implementation Strategy

This document tracks our incremental implementation approach:
1. Build small, testable pieces
2. Verify each piece works before moving forward
3. Adjust parameters and approach based on testing
4. Keep everything modular and configurable

---

## Phase 0: Shared Foundation (Test Locally)

**Goal**: Get deterministic generation working offline with a test script. No UI, just verify the core logic is solid.

### Components to Build

#### 1. Project Structure Setup
```
/packages
  /shared
    - noise.ts           # Perlin noise implementation
    - generation.ts      # Pure chunk generation function
    - config.ts          # All tunable parameters
    - types.ts           # Shared TypeScript types

/scripts
  - test-generation.ts   # Test script to verify generation
```

#### 2. Core Files

**`packages/shared/config.ts`**
- World constants (seed, version, chunk size, etc.)
- Noise parameters
- Building size parameters
- k-NN configuration (mock for now)
- All tunable values in one place

**`packages/shared/types.ts`**
- `WorldConfig` interface
- `ChunkData` interface
- `BuildingData` interface
- Other shared types

**`packages/shared/noise.ts`**
- Seeded random number generator
- Perlin noise 2D implementation
- Coordinate hashing utilities
- Helper functions for building placement

**`packages/shared/generation.ts`**
- `generateChunk(cx, cz, config)` - pure function
- Mock website selection (hash-based for now)
- Building size calculation
- Grid positioning with noise offsets

**`scripts/test-generation.ts`**
- Generate several chunks
- Output to JSON files
- Run assertions (determinism, building count, bounds checking)
- Visual inspection of generated data

### Testing Checklist

#### Test 1: Determinism
```typescript
const config = { ...DEFAULT_CONFIG, worldSeed: 42 };
const chunk1 = generateChunk(0, 0, config);
const chunk2 = generateChunk(0, 0, config);
// Assert: chunk1 deeply equals chunk2
```

#### Test 2: Building Count
```typescript
const chunk = generateChunk(0, 0, config);
// Assert: chunk.buildings.length === 16 (4x4 grid)
```

#### Test 3: Position Bounds
```typescript
const chunk = generateChunk(0, 0, config);
chunk.buildings.forEach(building => {
  // Assert: building.worldX within expected range
  // Assert: building.worldZ within expected range
  // Assert: offset from grid center <= MAX_POSITION_OFFSET
});
```

#### Test 4: Different Seeds = Different Worlds
```typescript
const chunk1 = generateChunk(0, 0, { ...config, worldSeed: 42 });
const chunk2 = generateChunk(0, 0, { ...config, worldSeed: 43 });
// Assert: chunk1 !== chunk2 (different buildings/positions)
```

#### Test 5: Adjacent Chunks
```typescript
// Generate 3x3 grid of chunks
const chunks = [];
for (let x = -1; x <= 1; x++) {
  for (let z = -1; z <= 1; z++) {
    chunks.push(generateChunk(x, z, config));
  }
}
// Visual inspection: Do chunk boundaries align correctly?
// Output to test-chunks.json for review
```

### Success Criteria

- ✅ All test assertions pass
- ✅ Same seed produces identical chunks every time
- ✅ Building positions look reasonable (within bounds)
- ✅ Different chunks have different buildings
- ✅ No crashes or errors
- ✅ Generated JSON is valid and complete

### Test Results (2025-11-08)

**All 11 tests PASSED!**

```
Test 1: Determinism ✓
Test 2: Building Count ✓ (16 buildings per chunk)
Test 3: Position Bounds ✓ (all within ±8 units)
Test 4: Building Size Bounds ✓ (width: 15-28, height: 25-120)
Test 5: Different Seeds = Different Worlds ✓
Test 6: Adjacent Chunks (3x3 grid) ✓ (144 total buildings)
Test 7: Chunk Metadata ✓
Test 8: No Road Cells ✓ (cross-pattern roads working)
Test 9: URL Uniqueness ✓ (14 unique URLs in 16 buildings)
```

**Generated Files**:
- `test-chunk-single.json` - Single chunk for detailed inspection
- `test-chunks-3x3.json` - 3×3 grid for spatial verification
- `test-summary.json` - Statistics and metadata

**Key Findings**:
- Average building width: ~17.67 units
- Average building height: ~47.67 units
- Cross-pattern roads (row/col 2) successfully divide chunks into 4 quadrants
- 16 buildings per chunk as expected
- Deterministic generation confirmed working

**Issues Encountered & Fixed**:
1. Initial road pattern was excluding edges (0, 4) giving only 9 buildings
   - **Fix**: Changed to cross-pattern (center row/col 2) giving 16 buildings
2. Test assertion for roads needed updating to match new pattern
   - **Fix**: Updated test to check for gridX === 2 || gridZ === 2

### Phase 0 Status: ✅ COMPLETE

All core generation logic is working correctly. Ready to proceed to Phase 1!

---

## Phase 1: Client-Only Visualization (No Server Yet)

**Goal**: See the 3D neighborhood in the browser. Generate chunks client-side, render with Three.js, walk around with WASD.

**Why client-only first**: Validate the visual feel before adding server complexity. All generation logic in `packages/shared` will be reused by the server later.

### Architecture Notes for Future Server Migration

**Current (Phase 1)**:
```
Browser → packages/shared/generation.ts → ChunkData → Three.js renderer
```

**Future (Phase 3+)**:
```
Browser → API fetch → Server (uses same generation.ts) → ChunkData (cached in D1) → Three.js renderer
```

**Key Design**: All types in `packages/shared/types.ts` are designed to work across the network:
- `ChunkData` is pure JSON (no methods, no circular refs)
- `WorldConfig` is serializable
- `BuildingData` maps 1:1 to database schema (Section 4.1 of spec)

### Components to Build

#### 1. Client Package Setup

**Directory**: `packages/client/`

**Dependencies**:
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.92.0",
    "three": "^0.160.0",
    "@3d-neighborhood/shared": "workspace:*"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.3"
  }
}
```

**Build tool**: Vite (fast dev server, HMR for rapid iteration)

#### 2. File Structure

```
packages/client/
├── src/
│   ├── main.tsx                 # Entry point, React root
│   ├── App.tsx                  # Root component, Canvas setup
│   ├── components/
│   │   ├── Scene.tsx            # Three.js scene (fog, lighting)
│   │   ├── World.tsx            # Chunk grid manager
│   │   ├── Chunk.tsx            # Single chunk renderer
│   │   ├── Building.tsx         # Individual building cube
│   │   └── Player.tsx           # WASD camera controller
│   ├── hooks/
│   │   └── useChunks.ts         # Generate chunks (client-side for now)
│   └── styles.css               # Minimal global styles
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

#### 3. Core Components

**`Scene.tsx`** - Three.js environment:
- Fog: `<fog attach="fog" args={['#ffffff', 150, 300]} />`
- Lighting: Ambient + directional
- Ground plane: White (#ffffff) per spec decisions
- Sky: White background

**`World.tsx`** - Chunk management:
- Generate 3×3 chunks around origin (cx/cz: -1 to 1)
- Use `generateChunk()` from `@3d-neighborhood/shared`
- Pass chunks to `<Chunk>` components
- Later: Replace with API fetching (Phase 3)

**`Chunk.tsx`** - Render buildings in a chunk:
- Map over `chunk.buildings`
- Render `<Building>` for each

**`Building.tsx`** - Individual building:
- `<Box>` geometry with width/height from data
- Position at worldX/worldZ
- Simple material (color based on URL hash for now)
- Later: Add windows, details, textures

**`Player.tsx`** - First-person controls:
- Use `@react-three/drei` `<PointerLockControls>`
- WASD movement
- Mouse look
- Position starts at origin (0, 1.6, 0) - eye height

#### 4. Data Flow (Client-Only)

```typescript
// hooks/useChunks.ts
import { generateChunk, DEFAULT_WORLD_CONFIG } from '@3d-neighborhood/shared';

export function useChunks() {
  const chunks = useMemo(() => {
    const result = [];
    for (let cx = -1; cx <= 1; cx++) {
      for (let cz = -1; cz <= 1; cz++) {
        result.push(generateChunk(cx, cz, DEFAULT_WORLD_CONFIG));
      }
    }
    return result;
  }, []);

  return chunks;
}
```

**Later (Phase 3)**: Replace with `fetch('/api/chunks/:cx/:cz')`

### Testing Checklist

#### Visual Tests (Manual)
- [ ] Buildings render as cubes
- [ ] Buildings positioned correctly (check a few against JSON)
- [ ] 3×3 chunks = 144 buildings visible
- [ ] Buildings have varied heights (25-120 range)
- [ ] Fog starts at ~150 units, full at ~300 units
- [ ] Can walk around with WASD
- [ ] Mouse look works
- [ ] No flickering or z-fighting
- [ ] Performance is smooth (60fps with 144 buildings)

#### Organic Feel Tests
- [ ] Buildings don't look perfectly grid-aligned
- [ ] Noise offset creates natural variation
- [ ] Road gaps visible between quadrants
- [ ] Can walk through roads between buildings

#### Parameter Tuning Tests
Change these in `packages/shared/config.ts` and verify visual changes:
- [ ] Adjust `noiseScale`: Does organic feel change?
- [ ] Adjust `maxPositionOffset`: More/less offset visible?
- [ ] Adjust building size ranges: Bigger/smaller buildings?

### Success Criteria

- ✅ Can walk around a 3D neighborhood
- ✅ 144 buildings render correctly
- ✅ Buildings look organic (not too grid-like)
- ✅ Fog creates atmosphere
- ✅ Performance is acceptable
- ✅ Changing config.ts parameters updates visuals
- ✅ Building positions match test JSON data

### Migration Notes for Phase 3

When adding the server, these changes will be minimal:

**Change 1**: `useChunks.ts`
```typescript
// Before (Phase 1):
const chunk = generateChunk(cx, cz, config);

// After (Phase 3):
const response = await fetch(`/api/chunks/${cx}/${cz}`);
const chunk: ChunkData = await response.json();
// Same type, same rendering!
```

**Change 2**: Add IndexedDB caching
- Cache fetched chunks locally
- Reduces API calls on revisit

**No changes needed**:
- `Building.tsx` - Same ChunkData input
- `Chunk.tsx` - Same rendering logic
- `Scene.tsx` - Same visuals
- All types remain identical

### Test Results (2025-11-08)

**Dev Server**: Running at http://localhost:3000/

**Visual Tests**:
- ✅ Buildings render as colored cubes
- ✅ 144 buildings visible (3×3 chunks = 9 chunks × 16 buildings)
- ✅ Buildings have varied heights (25-120 range visible)
- ✅ Buildings have varied colors (deterministic HSL from URL hash)
- ✅ Fog visible in distance (white fog 150-300 units)
- ✅ Can walk around with WASD
- ✅ Mouse look works (pointer lock controls)
- ✅ Performance smooth (60fps with 144 buildings)

**Organic Feel**:
- ✅ Buildings not perfectly grid-aligned (noise offset working)
- ✅ Road gaps visible between building quadrants
- ✅ Can walk through roads between buildings

**Issues Encountered & Fixed**:

1. **Left/Right controls backwards**
   - **Problem**: A/D keys moved in opposite directions
   - **Cause**: Cross product order in `Player.tsx` was reversed
   - **Fix**: Changed `crossVectors(camera.up, direction)` to `crossVectors(direction, camera.up)`
   - **Result**: A/D now correctly strafe left/right

2. **Favicon 404 error**
   - **Problem**: Browser console showed 404 for `/favicon.ico`
   - **Fix**: Created `packages/client/public/favicon.svg` with simple building icon
   - **Result**: No more console errors

3. **Workspace dependency issue**
   - **Problem**: `npm install` failed with `workspace:*` protocol
   - **Fix**: Changed to `file:../shared` in package.json
   - **Result**: Dependencies install correctly

**Files Created**:
```
packages/client/
├── public/
│   └── favicon.svg           # Building icon
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Canvas setup with instructions overlay
│   ├── components/
│   │   ├── Scene.tsx         # Fog, lighting, ground plane
│   │   ├── World.tsx         # Chunk manager (3×3 grid)
│   │   ├── Chunk.tsx         # Renders buildings per chunk
│   │   ├── Building.tsx      # Individual cube with HSL color
│   │   └── Player.tsx        # WASD + mouse controls
│   └── hooks/
│       └── useChunks.ts      # Client-side chunk generation
├── index.html                # Entry HTML with favicon link
├── vite.config.ts            # Vite config (port 3000)
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies + scripts
```

**Key Implementation Details**:

1. **Building Colors**: Deterministic HSL based on URL hash
   ```typescript
   const hash = hashString(building.url);
   const hue = (hash % 360);
   const saturation = 40 + (hash % 20); // 40-60%
   const lightness = 50 + (hash % 15);  // 50-65%
   ```

2. **Movement Speed**: 50 units/second
3. **Eye Height**: 1.6 units (stays constant)
4. **Camera FOV**: 75 degrees
5. **Shadow Maps**: 2048×2048 for quality

### Phase 1 Status: ✅ COMPLETE

Client-side 3D visualization working! Can walk around, see 144 buildings with varied heights/colors, fog atmosphere.

**Ready for**: Parameter tuning, visual polish, or moving to Phase 2/3.

---

## Phase 2: Data Pipeline

**Status**: ✅ COMPLETE (done by other Claude instance)

**What Was Built:**
- Modal.com scraping pipeline (50 parallel workers)
- 548 websites successfully scraped from Tranco Top 1M
- GPU-accelerated embeddings (NVIDIA A10G, all-MiniLM-L6-v2, 384 dimensions)
- SQLite database with semantic embeddings
- k-NN search validated (sites cluster by semantic similarity)

**Database Location:** `scripts/data-pipeline/output/neighborhood.db`

**Cost:** ~$0.03 (scraping + embeddings on Modal)

---

## Phase 3: Server + Database

**Goal**: Serve chunks from API with real k-NN semantic similarity, cached in D1

**Status**: ✅ COMPLETE - Full stack working locally!

### Architecture

```
Client (Vite :3001)
  ↓ /api/* proxied to
Server (Wrangler :8787)
  ↓ uses
D1 Database (548 websites + embeddings)
  ↓ k-NN in-memory
Semantic similarity working!
```

### Components Built

#### 1. Server Package (`packages/server/`)

**Files Created:**
- `src/index.ts` - Hono API server
- `src/knn.ts` - In-memory cosine similarity search
- `schema.sql` - D1 database schema
- `scripts/import-local-db.ts` - Import from pipeline DB
- `wrangler.toml` - Cloudflare Workers config
- `package.json` - Dependencies (Hono, Wrangler, etc.)

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/chunks/:cx/:cz` - Chunk generation with k-NN

**Key Implementation Details:**

**In-Memory k-NN** (`src/knn.ts`):
```typescript
// Loads all 548 embeddings once (~850KB)
// Cosine similarity computation
// Returns top-k similar websites to anchor
```

**Chunk Generation** (`src/index.ts`):
```typescript
// 1. Check D1 cache
// 2. If not cached:
//    - Get random anchor website
//    - Find 50 similar sites via k-NN
//    - Generate chunk with those sites
//    - Cache in D1
// 3. Return ChunkResponse
```

#### 2. Type-Safe API (`packages/shared/api.ts`)

```typescript
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
    title?: string;
  }>;
}

export async function fetchChunk(cx, cz, baseUrl): Promise<ChunkResponse>
```

#### 3. Client Updates

**Updated Files:**
- `src/hooks/useChunks.ts` - Now fetches from API instead of local generation
- `vite.config.ts` - Added proxy to forward `/api/*` to `localhost:8787`

**Before (Phase 1):**
```typescript
// Client-side generation
const chunks = generateChunk(cx, cz, config);
```

**After (Phase 3):**
```typescript
// API fetch with type safety
const chunk = await fetchChunk(cx, cz);
```

### Database Schema (D1)

```sql
-- Websites with embeddings (imported from pipeline)
CREATE TABLE websites (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  embedding BLOB,              -- 384-dim Float32Array
  embedding_dim INTEGER,       -- 384
  popularity_score REAL,
  scraped_at TEXT
);

-- Cached chunks (JSON blobs)
CREATE TABLE chunks (
  chunk_x INTEGER,
  chunk_z INTEGER,
  data TEXT,                   -- JSON string
  world_version INTEGER,
  generated_at TEXT,
  PRIMARY KEY (chunk_x, chunk_z)
);
```

### Test Results (2025-11-09)

**Local Development Setup:**
```bash
# Terminal 1: Server
cd packages/server
npm run dev
# → Running at http://localhost:8787

# Terminal 2: Client
cd packages/client
npm run dev
# → Running at http://localhost:3001
# → API requests proxied to :8787
```

**Performance:**
- ✅ 548 embeddings loaded into memory successfully
- ✅ First chunk generation: ~52ms (generation + k-NN + cache)
- ✅ Cached chunks: 2-5ms (from D1)
- ✅ Client successfully fetched all 9 chunks (3×3 grid)
- ✅ Buildings render with real website data

**Server Logs:**
```
Loaded 548 embeddings into memory
[wrangler:inf] GET /api/chunks/0/0 200 OK (52ms)   # Generated
[wrangler:inf] GET /api/chunks/0/0 200 OK (2ms)    # Cached!
```

**Issues Encountered & Fixed:**

1. **D1 Database ID**
   - **Problem**: `wrangler d1 execute` couldn't find database
   - **Cause**: Empty `database_id` in wrangler.toml
   - **Fix**: Used placeholder "local-dev-db-id" for local development
   - **Result**: Local D1 working perfectly

2. **TypeScript Type Errors in API**
   - **Problem**: `res.json()` returns `unknown`, not typed
   - **Fix**: Added type assertions `as ChunkResponse` and `as ErrorResponse`
   - **Result**: Type-safe API working

3. **Client Port Conflict**
   - **Problem**: Port 3000 already in use
   - **Fix**: Vite automatically used port 3001
   - **Result**: Both servers running on different ports, proxy working

### Files Created

**Server:**
```
packages/server/
├── src/
│   ├── index.ts              # Hono API server
│   └── knn.ts                # In-memory k-NN search
├── scripts/
│   └── import-local-db.ts    # DB import script
├── schema.sql                # D1 schema
├── wrangler.toml             # Cloudflare config
├── tsconfig.json
└── package.json
```

**Shared:**
```
packages/shared/src/
└── api.ts                    # Type-safe API client
```

### Phase 3 Status: ✅ COMPLETE

**What's Working:**
- ✅ Cloudflare Workers + D1 (local dev)
- ✅ 548 websites with real embeddings
- ✅ In-memory k-NN semantic similarity
- ✅ Chunk caching (first: 52ms, cached: 2-5ms)
- ✅ Type-safe API (client ↔ server)
- ✅ Client fetching from API
- ✅ 3D visualization with real data
- ✅ Vite proxy working

**Ready For:**
- Testing in browser (http://localhost:3001)
- Semantic similarity validation
- Parameter tuning
- Cloud deployment (Cloudflare)

---

## Phase 4: Mall System Polish

**Goal**: Improve the exploration and navigation experience with the existing 548-website dataset before scaling to full KNN implementation

**Status**: 🚧 IN PROGRESS

**Philosophy**: Focus on perfecting the "mall" experience - how users discover, navigate, and interact with websites in 3D space. Use mock values and existing data to iterate quickly on UX without building full KNN infrastructure yet.

### Recent Improvements (2025-11-11)

#### 1. ✅ Minimap with Real-Time Updates

**Problem**: Minimap showed static spawn position, not dynamic player position

**Solution**:
- Updated `usePlayerPosition` hook integration
- Converted position object `{ x, y, z, chunkX, chunkZ }` to array format `[x, y, z]`
- Minimap now updates in real-time as player moves

**Files Modified**:
- `packages/client/src/App.tsx:224` - Pass dynamic `playerPosition` instead of static `spawnPoint.position`

**Result**: Red player dot on minimap now tracks movement across chunk boundaries

#### 2. ✅ Directional Compass Indicator

**Problem**: No visual indication of which direction player is facing on minimap

**Solution**:
- Added camera rotation tracking in `Player.tsx`
- Calculate yaw angle from camera direction vector
- Pass rotation to Minimap via new `cameraYaw` prop
- Render vision cone/fan on minimap canvas

**Implementation Details**:
- **Player.tsx**: Added `onRotationChange` callback, calculates `yaw = atan2(direction.x, direction.z)`
- **App.tsx**: Track `cameraYaw` state, pass to both Player and Minimap
- **Minimap.tsx**:
  - Quarter-circle (90° arc) vision cone
  - Radial gradient: opaque at center → transparent at edge
  - 25-pixel radius fan
  - Rotates in real-time with camera

**Visual Design**:
```typescript
// Golden/yellow fan that fades out
const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
gradient.addColorStop(0, 'rgba(255, 200, 0, 0.5)');   // bright center
gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.25)'); // fade middle
gradient.addColorStop(1, 'rgba(255, 200, 0, 0)');      // transparent edge
```

**Files Modified**:
- `packages/client/src/components/Player.tsx:18,31,253-256` - Camera rotation tracking
- `packages/client/src/App.tsx:34,155,227` - Rotation state management
- `packages/client/src/components/Minimap.tsx:8,14,141-165,147` - Vision cone rendering

**Result**: Player can see which direction they're facing on minimap with smooth rotation animation

### Next Steps: Mall System Iteration

**Strategy**: Keep using the 548-website dataset and focus on making the exploration experience great. Defer KNN improvements and dataset scaling until the core mall mechanics are solid.

#### Priority 1: Navigation & Discovery 🎯

**Dynamic Chunk Loading**:
- [ ] Load chunks dynamically based on player position (currently loads 3×3 at spawn)
- [ ] Unload distant chunks to maintain performance
- [ ] Implement chunk loading radius (e.g., 2-3 chunks around player)
- [ ] Add loading indicators for new chunks
- [ ] Track "new chunks this session" statistic (already tracked, need to make useful)

**Spawn & Entry Points**:
- [x] Entry point API (`/api/entry-point`) working
- [ ] Test entry point system with various URLs
- [ ] Add "home" marker on minimap for spawn point
- [ ] Breadcrumb trail or path showing where you've been
- [ ] "Return to spawn" hotkey/button

**World Navigation**:
- [ ] Add coordinate display (current chunk, world position)
- [ ] Search/teleport to specific websites
- [ ] Minimap zoom controls
- [ ] North indicator on minimap (static)
- [ ] Chunk grid overlay on minimap (toggle)

#### Priority 2: Building Interaction 🏢

**Click/Collision Actions**:
- [ ] Click building to open website in new tab
- [ ] Or: Click to show preview modal with iframe
- [ ] Collision detection already exists - add URL redirect on collision
- [ ] Visual feedback when targeting building (already has crosshair change)
- [ ] Building info panel (URL, title, semantic similarity score?)

**Visual Feedback**:
- [ ] Hover highlight on buildings (currently shows URL in top-right)
- [ ] Distance-to-target display
- [ ] Building labels that fade in when close
- [ ] Visited buildings change color/style

#### Priority 3: Visual Polish ✨

**Building Details**:
- [ ] Windows (grid pattern based on building dimensions)
- [ ] Roof variations (flat, peaked, modern)
- [ ] Building texture/materials (not just solid colors)
- [ ] Ground floor distinction (darker, larger windows)
- [ ] Building variety (not all cubes - some L-shaped, U-shaped?)

**World Details**:
- [ ] Actual road geometry (gray planes with line markings)
- [ ] Sidewalks along roads
- [ ] Street lights at intersections
- [ ] Ground texture (subtle grid or pattern)
- [ ] Sky gradient (white → light blue)

**Lighting & Atmosphere**:
- [ ] Time of day control (affects lighting/colors)
- [ ] Building interior lighting (glowing windows at night)
- [ ] Shadows (sun direction based on time of day)
- [ ] Ambient occlusion for depth

#### Priority 4: Performance & Scale 📈

**Optimization**:
- [ ] Test with more chunks visible (5×5, 7×7)
- [ ] Implement LOD (Level of Detail) for distant buildings
  - Close: Full detail with windows
  - Medium: Simple geometry, solid colors
  - Far: Instanced boxes
- [ ] GPU instancing for building meshes
- [ ] Frustum culling (Three.js may do this already)

**Monitoring**:
- [ ] FPS counter (add to stats panel)
- [ ] Chunks loaded counter
- [ ] Buildings rendered counter
- [ ] Memory usage display

#### Priority 5: UI/UX Improvements 🎨

**HUD Enhancements**:
- [ ] Better stats panel design
- [ ] Hide/show UI toggle (for screenshots)
- [ ] Settings panel (fog distance, render distance, etc.)
- [ ] Help overlay (keybinds, controls)

**Minimap Enhancements**:
- [ ] Toggle minimap visibility
- [ ] Minimap size adjustment
- [ ] Click minimap to teleport (creative mode only?)
- [ ] Show nearby building clusters (color by semantic group?)

**Quality of Life**:
- [ ] Sprint key (hold Shift to move faster)
- [ ] Jump key (Space) - why not?
- [ ] Crouch key (C) - lower camera
- [ ] FOV slider
- [ ] Mouse sensitivity adjustment

### Mall System Design Questions

**Interaction Model**:
- Should buildings be clickable to visit URLs?
- Or should collision trigger URL redirect?
- Or both (click = new tab, collision = redirect)?
- Should there be a preview mode before visiting?

**Discovery Mechanics**:
- How should semantic similarity be visualized?
- Should similar buildings cluster spatially? (They should based on KNN)
- Visual cues for "neighborhoods" of similar sites?
- Color coding by category/similarity?

**Navigation Philosophy**:
- Encourage exploration vs. efficient search?
- Should there be a "fast travel" system?
- How to handle getting lost? (Always show spawn point?)
- Balance between walking simulation and UX convenience

**Scale & Scope**:
- How many chunks should be explorable? (Infinite? Or bounded grid?)
- What happens at world edges?
- How to handle 548 websites → eventually 100K+ websites?

### Testing Priorities

**User Experience Tests**:
1. Spawn at random building, try to find way back
2. Visit 10 buildings via collision, measure time/ease
3. Test minimap usefulness during exploration
4. Identify confusing/frustrating moments

**Performance Tests**:
1. Render 5×5 chunks (25 chunks × 16 buildings = 400 buildings)
2. Measure FPS with different fog distances
3. Test chunk loading/unloading smoothness
4. Profile memory usage over time

**Visual Tests**:
1. Compare building dimension options (width/height ranges)
2. Test different color schemes for buildings
3. Evaluate road visibility and navigation
4. Test fog density for atmosphere vs. visibility

### Phase 4 Status: 🚧 IN PROGRESS

**Completed**:
- ✅ Minimap real-time position tracking
- ✅ Directional compass/vision cone on minimap

**Current Focus**: Deciding on next iteration priorities

**Deferred for Later**:
- KNN improvements and optimization
- Full dataset expansion (548 → 100K+)
- Vectorize integration
- Semantic similarity visualization
- Advanced clustering algorithms

---

## Notes & Decisions

### 2025-11-08 - Phase 0 Complete
- ✅ Created implementation tracking document
- ✅ Implemented pure generation logic (deterministic)
- ✅ Tested with script before building UI
- ✅ All 11 tests passing
- **Decision**: Cross-pattern roads (center row/col) instead of edge roads
  - Rationale: Gives us 4×4 building grid (16 buildings) as specified
  - Creates visual "crossroads" dividing chunk into quadrants
  - Implementation: `isRoadCell()` returns true when `gridX === 2 || gridZ === 2`
  - Visual result: Each chunk has roads forming a "+" shape through the middle
  - Can be adjusted later if needed (it's just a pure function)
- **Architecture decision**: All types in `packages/shared` are JSON-serializable
  - Ready for API later (ChunkData can be sent over HTTP as-is)
  - No circular references, no methods, no classes
  - Server can use same generation.ts or cache results

### 2025-11-08 - Phase 1 Complete
- ✅ Set up Vite + React + Three.js client
- ✅ Created 3D scene with fog, lighting, ground
- ✅ Implemented WASD + mouse controls
- ✅ Rendered 144 buildings (3×3 chunks) client-side
- ✅ Buildings have deterministic colors from URL hash
- ✅ Fixed left/right control inversion
- ✅ Fixed favicon 404 error
- ✅ Confirmed organic feel from noise offsets
- **Testing**: Visually confirmed in browser, all movement working
- **Performance**: Smooth 60fps with 144 buildings
- **Next**: Decide on polish vs. moving to Phase 2/3

### 2025-11-09 - Phase 3 Complete
- ✅ Created Cloudflare Workers + D1 server infrastructure
- ✅ Implemented Hono API with chunk generation endpoint
- ✅ Built in-memory k-NN semantic similarity (548 embeddings, ~850KB)
- ✅ Imported 548 websites + embeddings from data pipeline
- ✅ Created type-safe API layer (shared between client/server)
- ✅ Updated client to fetch from API instead of local generation
- ✅ Configured Vite proxy for local development
- ✅ Chunk caching working (first: 52ms, cached: 2-5ms)
- **Testing**: Full stack tested locally, all endpoints working
- **Performance**: Embeddings load once, k-NN is fast (<50ms)
- **Architecture**: Clean separation - client fetches, server generates, D1 caches
- **Decision**: In-memory k-NN works great for 548 sites (no Vectorize needed yet)
  - Rationale: ~850KB fits easily in memory, cosine similarity is fast
  - Can migrate to Vectorize later when scaling to 1M sites
  - Keeps stack simple for now
- **Decision**: Simplified chunk generation (random anchor + k-NN)
  - Uses random anchor website per chunk (for now)
  - Finds 50 similar sites via k-NN
  - Selects from those for building placement
  - Later: Use adjacent chunks as anchors for better clustering
- **Next**: Test semantic similarity in browser, validate clustering works

### 2025-11-11 - Phase 4 Started: Mall System Focus
- ✅ Fixed minimap to show real-time player position (was showing static spawn point)
- ✅ Added directional compass indicator (vision cone that rotates with camera)
- **Testing**: Minimap now updates when crossing chunk borders, compass shows orientation
- **Visual Design**: Quarter-circle fan with radial gradient (golden yellow, fades to transparent)
- **Decision**: Focus on "mall system" polish before scaling KNN
  - Rationale: Better to perfect the exploration UX with existing 548 sites
  - Defer dataset expansion and KNN optimization until core mechanics are solid
  - Use mock values and iterate quickly on feel/navigation
- **Decision**: Prioritize navigation aids and building interaction next
  - Dynamic chunk loading based on player position
  - Click/collision to visit websites
  - Visual polish (windows, roads, better materials)
  - Performance testing with more chunks
- **Next Steps Documented**: Created comprehensive Phase 4 roadmap with 5 priority areas
  1. Navigation & Discovery (dynamic loading, spawn markers, coordinates)
  2. Building Interaction (click to visit, collision handling, info panels)
  3. Visual Polish (windows, roads, lighting, textures)
  4. Performance & Scale (LOD, instancing, monitoring)
  5. UI/UX Improvements (stats, settings, quality of life features)

---

## Blockers & Questions

None currently blocking progress.

### Open Questions for Phase 4

**Immediate Next Features** (Priority order for implementation):
1. [ ] **Dynamic chunk loading** - Load/unload chunks based on player position?
2. [ ] **Building interaction** - Click or collision to visit website?
3. [ ] **Visual improvements** - Windows, roads, textures?
4. [ ] **Performance testing** - How many chunks can we render smoothly?

**Design Decisions Needed**:

**Building Interaction Model**:
- How should users visit websites?
  - Option A: Click building to open in new tab
  - Option B: Collision redirects to URL
  - Option C: Both (click = new tab, collision = redirect)
  - Option D: Preview modal first, then visit
- Current: Collision detection exists but no action taken

**Visual Style Direction**:
- Building dimensions: Keep current ranges (W: 15-28, H: 25-120) or adjust?
- Color scheme: Keep HSL variety or use semantic categories?
- Road visualization: Add actual geometry or keep as gaps?
- Windows: Simple grid pattern or detailed/random?
- Overall aesthetic: Minimal/clean vs. detailed/realistic?

**Navigation Philosophy**:
- Encourage wandering/exploration vs. efficient search?
- Fast travel system or pure walking simulation?
- How to handle getting lost? (Show spawn point? Breadcrumbs?)
- Balance realism vs. convenience

**Scale & Performance**:
- Target render distance: How many chunks? (Current: 3×3 at spawn)
- Dynamic loading radius: 2 chunks? 3 chunks?
- LOD implementation priority: Now or later?
- FPS target: 60fps? 30fps acceptable?

**Deferred Questions** (Not blocking current work):
- Dataset expansion strategy (548 → 100K+)
- Semantic similarity visualization improvements
- KNN optimization and Vectorize migration
- Cloud deployment and scaling

---

## Rollback & Resume Instructions

This section helps you resume work or rollback to specific phases.

### Current State (End of Phase 1)

**Working code**:
- `packages/shared/` - Complete, tested, all 11 tests passing
- `packages/client/` - Complete, 3D visualization working
- Dev server: Running at http://localhost:3000/

**Git checkpoint** (recommended):
```bash
git add .
git commit -m "Phase 1 complete: 3D visualization with WASD controls working"
git tag phase-1-complete
```

### To Resume Phase 1

```bash
# Install dependencies (if needed)
npm install

# Build shared package (if needed)
cd packages/shared && npm run build && cd ../..

# Start dev server
cd packages/client && npm run dev

# Open browser to http://localhost:3000/
# Should see 144 buildings, click to lock pointer, use WASD to move
```

### To Rollback to Phase 0

```bash
# If you have the tag
git checkout phase-0-complete

# Or manually
rm -rf packages/client  # Remove client
npm run test:generation # Verify Phase 0 works
```

### To Stop Dev Server

```bash
# If running in foreground: Ctrl+C

# If running in background: Find process and kill
lsof -ti:3000 | xargs kill
```

### File Manifest for Phase 1

**Can safely delete** (if rolling back):
- `packages/client/` - Entire directory

**Must keep** (core system):
- `packages/shared/` - Generation logic
- `scripts/test-generation.ts` - Tests
- `IMPLEMENTATION.md` - This file
- `PROJECT_SPEC.md` - Design spec (if in `/specs` instead)

---

## Configuration Tuning Log

| Date | Parameter | Old Value | New Value | Reason |
|------|-----------|-----------|-----------|--------|
| 2025-11-08 | Road Pattern | Edge cells (0, 4) | Cross pattern (center 2) | Need 16 buildings (4×4), not 9 (3×3) |
| - | All others | - | Using defaults from spec | Phase 0 baseline established |

**Current Configuration** (from `packages/shared/config.ts`):
- World Seed: 42
- Chunk Grid Size: 5×5 cells
- Buildings Per Chunk: 16 (4×4 grid)
- Cell Size: 30 units
- Noise Scale: 0.1
- Max Position Offset: ±8 units
- Building Size: Width 15-28, Height 25-120
- Size Noise Variation: ±20%

---

## Summary & Current Status

### What's Working

✅ **Phase 0 - Core Generation**:
- Pure deterministic chunk generation
- Perlin noise for organic positioning
- Mock website data (50 sites)
- 11 automated tests passing
- Cross-pattern roads (4×4 building grid)

✅ **Phase 1 - 3D Visualization**:
- React + Three.js client
- WASD + mouse controls
- Fog atmosphere (white, 150-300 units)
- Deterministic building colors (HSL from URL)
- 60fps performance

✅ **Phase 2 - Data Pipeline**:
- 548 websites scraped from Tranco Top 1M
- GPU-accelerated embeddings (384-dimensional vectors)
- SQLite database with semantic embeddings
- Modal.com pipeline (~$0.03 cost)

✅ **Phase 3 - Full Stack**:
- Cloudflare Workers + D1 database
- Hono API server with type-safe endpoints
- In-memory k-NN semantic similarity
- Chunk caching (52ms uncached, 2-5ms cached)
- Client-server integration via Vite proxy
- Entry point system for spawning at specific URLs

✅ **Phase 4 - Mall System Polish** (IN PROGRESS):
- Real-time minimap with position tracking
- Directional compass/vision cone indicator
- Minimap updates on chunk border crossing

### What's Next

**Current Focus**: Phase 4 - Mall System Iteration

**Strategy**: Perfect the exploration experience with existing 548-site dataset before scaling KNN infrastructure

**Priority Areas**:
1. **Navigation & Discovery** - Dynamic chunk loading, spawn markers, coordinate display
2. **Building Interaction** - Click/collision to visit websites, info panels
3. **Visual Polish** - Windows, roads, lighting, better materials
4. **Performance** - LOD, instancing, monitoring
5. **UI/UX** - Settings, stats, quality of life features

**Deferred**:
- Dataset expansion (548 → 100K+)
- KNN optimization and Vectorize integration
- Advanced semantic similarity features

### Key Files

**Critical (don't delete)**:
- `packages/shared/` - Generation logic (used by client and future server)
- `IMPLEMENTATION.md` - This file
- `/specs` - Design specifications (authoritative)

**Phase 1 (can rollback)**:
- `packages/client/` - 3D visualization

**Development**:
- Dev server at http://localhost:3000/
- Test suite: `npm run test:generation`

---

## Phase 5: Cloudflare Production Deployment

**Goal**: Deploy the full application to Cloudflare (Workers + Pages + D1) for public access

**Status**: 🚧 IN PROGRESS (started 2025-11-11)

**Target Architecture**:
```
Cloudflare Pages (Frontend)
  ↓ HTTPS
Cloudflare Workers (API)
  ↓ D1 binding
Cloudflare D1 (Database)
```

### Deployment Plan

#### Overview

**Current State**:
- ✅ Backend configured for Cloudflare Workers (`wrangler.toml` exists)
- ✅ D1 database schema defined (`schema.sql`)
- ✅ Sample data ready (548 websites with embeddings)
- ❌ Database empty (needs data import)
- ❌ Frontend not configured for production deployment
- ❌ No environment-based API URL configuration

**Deployment Stack**:
1. **Cloudflare Workers**: Hono API (already configured)
2. **Cloudflare D1**: SQLite database (schema ready)
3. **Cloudflare Pages**: Vite frontend (needs configuration)

#### Phase 5.1: Data Import ✅ COMPLETE

**Goal**: Get sample data into local database for testing

**Tasks**:
1. ✅ Import sample data to SQLite (`scripts/data-pipeline/output/neighborhood.db`)
2. ✅ Initialize local D1 database with schema
3. ✅ Import SQLite data to local D1
4. ✅ Verify data integrity

**Scripts Created**:
- `npm run data:import-sample` - Import sample metadata/embeddings to SQLite
- `npm run db:import-local` - Import SQLite → local D1

**Results**:
- Local SQLite database populated with 548 websites + embeddings
- Local D1 database ready for testing
- Data integrity verified

#### Phase 5.2: Frontend Configuration ✅ COMPLETE

**Goal**: Make frontend work in both dev and production environments

**Changes Made**:

1. **Environment Variable Support**:
   - Created `.env.development` and `.env.production`
   - API URL configurable via `VITE_API_URL`
   - Dev: `http://localhost:8787`
   - Prod: `https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev` (to be filled)

2. **API Client Updates**:
   - Updated `packages/shared/src/api.ts` to use environment variables
   - Added runtime API URL detection
   - Fallback to localhost for development

3. **Type Definitions**:
   - Added `vite-env.d.ts` for TypeScript support
   - Environment variables properly typed

**Files Modified**:
- `packages/client/.env.development` (new)
- `packages/client/.env.production` (new)
- `packages/client/src/vite-env.d.ts` (new)
- `packages/shared/src/api.ts` (updated)

#### Phase 5.3: Cloudflare Pages Configuration ✅ COMPLETE

**Goal**: Configure frontend for Cloudflare Pages deployment

**Files Created**:
1. `packages/client/wrangler.toml` - Pages deployment config
2. `.github/workflows/deploy.yml` - (Optional) CI/CD automation

**Configuration**:
```toml
name = "3d-neighborhood"
pages_build_output_dir = "dist"

[build]
command = "npm run build"

[env.production]
VITE_API_URL = "https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev"
```

#### Phase 5.4: Deployment Scripts ✅ COMPLETE

**Goal**: One-command deployment for both frontend and backend

**Scripts Added to Root `package.json`**:
- `npm run deploy:backend` - Deploy Cloudflare Workers API
- `npm run deploy:frontend` - Deploy Cloudflare Pages
- `npm run deploy:all` - Deploy both (requires manual steps first)
- `npm run build:all` - Build both client and server
- `npm run export:production-data` - Export local D1 data for production import

**Build Pipeline**:
```bash
# Build everything
npm run build:all

# Deploy backend
npm run deploy:backend

# Deploy frontend
npm run deploy:frontend
```

#### Phase 5.5: Production Database Setup

**Goal**: Create production D1 database and import data

**Manual Steps Required** (User must do these):

1. **Create Production D1 Database**:
   ```bash
   wrangler d1 create neighborhood-db
   ```
   - This will output a database ID
   - Copy the database ID from the output

2. **Update `wrangler.toml`** in `packages/server/`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "neighborhood-db"
   database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID
   ```

3. **Initialize Production Database Schema**:
   ```bash
   cd packages/server
   wrangler d1 execute neighborhood-db --remote --file=schema.sql
   wrangler d1 execute neighborhood-db --remote --file=migrations/001_add_placements.sql
   ```

4. **Import Data to Production D1**:
   ```bash
   # Export local data to SQL dump
   npm run export:production-data

   # Import to production D1
   cd packages/server
   wrangler d1 execute neighborhood-db --remote --file=../scripts/data-pipeline/output/production-export.sql
   ```

5. **Deploy Backend to Workers**:
   ```bash
   cd packages/server
   npm run deploy
   ```
   - Note the deployed URL (e.g., `https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev`)

6. **Update Frontend Environment Variable**:
   - Edit `packages/client/.env.production`
   - Set `VITE_API_URL` to your deployed Workers URL

7. **Deploy Frontend to Pages**:
   ```bash
   cd packages/client
   wrangler pages deploy dist --project-name=3d-neighborhood
   ```
   - Note the deployed URL (e.g., `https://3d-neighborhood.pages.dev`)

8. **(Optional) Set Up Custom Domain**:
   - Go to Cloudflare Dashboard → Pages → 3d-neighborhood → Custom domains
   - Add your custom domain (e.g., `neighborhood.yourdomain.com`)

### Manual Steps Checklist for User

**Before Deploying**:
- [ ] Have Cloudflare account with Workers & Pages enabled
- [ ] Have Wrangler CLI installed and authenticated (`wrangler login`)
- [ ] Local data imported and tested

**Production Database Setup**:
- [ ] Run `wrangler d1 create neighborhood-db`
- [ ] Copy database ID from output
- [ ] Update `packages/server/wrangler.toml` with database ID
- [ ] Run schema initialization scripts (see step 3 above)
- [ ] Import data to production D1 (see step 4 above)

**Backend Deployment**:
- [ ] Deploy Workers: `cd packages/server && npm run deploy`
- [ ] Copy deployed Workers URL
- [ ] Test API health: `curl https://YOUR-URL.workers.dev/health`

**Frontend Deployment**:
- [ ] Update `packages/client/.env.production` with Workers URL
- [ ] Build frontend: `cd packages/client && npm run build`
- [ ] Deploy to Pages: `wrangler pages deploy dist --project-name=3d-neighborhood`
- [ ] Test deployed site in browser
- [ ] (Optional) Add custom domain in Cloudflare Dashboard

**Verification**:
- [ ] Visit deployed site URL
- [ ] Test website search
- [ ] Test 3D navigation
- [ ] Verify chunks load properly
- [ ] Check browser console for errors

### Deployment Scripts Created

**Root `package.json` Scripts**:
```json
{
  "build:all": "Build both client and server",
  "deploy:backend": "Deploy Cloudflare Workers API",
  "deploy:frontend": "Deploy Cloudflare Pages",
  "deploy:all": "Deploy both (after manual steps)",
  "export:production-data": "Export local data for production import"
}
```

**Server Scripts** (`packages/server/package.json`):
```json
{
  "deploy": "wrangler deploy",
  "db:create-local": "wrangler d1 create neighborhood-db --local",
  "db:init-local": "Initialize local D1 schema",
  "db:import-local": "Import SQLite data to local D1"
}
```

**Client Scripts** (`packages/client/package.json`):
```json
{
  "build": "vite build",
  "deploy": "wrangler pages deploy dist"
}
```

### Configuration Files Created

**Frontend Environment Variables**:
- `packages/client/.env.development` - Local dev (localhost:8787)
- `packages/client/.env.production` - Production (Workers URL)

**Cloudflare Configurations**:
- `packages/server/wrangler.toml` - Workers config (already existed, may need DB ID update)
- `packages/client/wrangler.toml` - Pages config (NEW)

**Database Files**:
- `packages/server/schema.sql` - Database schema (already exists)
- `packages/server/migrations/001_add_placements.sql` - Migrations (already exists)
- `scripts/data-pipeline/output/production-export.sql` - Generated SQL dump (created by export script)

### Cost Estimates

**Cloudflare Free Tier Limits**:
- Workers: 100,000 requests/day
- D1: 5GB storage, 5M reads/day, 100K writes/day
- Pages: Unlimited bandwidth, 500 builds/month

**Expected Costs for 3D Neighborhood** (initial deployment):
- **Free** - Well within free tier limits
- Workers requests: ~1000/day initially
- D1 database: ~2MB for 548 websites
- Pages: Static hosting (free)

**If Scaling to 100K+ Sites**:
- D1 storage: ~400MB (still free)
- May need Workers Paid plan ($5/month) for higher request volume
- Vectorize: $0.04 per 1M queries (if migrating from in-memory k-NN)

### Testing Plan

**Local Testing** (before deployment):
- ✅ Local dev server working (`npm run dev`)
- ✅ API endpoints responding
- ✅ Database queries working
- ✅ Frontend fetching data correctly

**Production Testing** (after deployment):
- [ ] Health check endpoint (`/health`)
- [ ] Website search endpoint (`/api/websites?q=test`)
- [ ] Chunk generation endpoint (`/api/chunks/0/0`)
- [ ] Entry point endpoint (`/api/entry-point`)
- [ ] Stats endpoint (`/api/stats`)
- [ ] Frontend loads and renders
- [ ] 3D navigation works
- [ ] Minimap updates
- [ ] Performance acceptable

**Performance Benchmarks**:
- Target: <100ms for cached chunks
- Target: <500ms for new chunk generation
- Target: 60fps in 3D view
- Target: <2s initial page load

### Rollback Plan

**If deployment fails**:

1. **Backend Issues**:
   - Check Wrangler logs: `wrangler tail`
   - Verify D1 database ID in `wrangler.toml`
   - Test locally: `cd packages/server && npm run dev`

2. **Frontend Issues**:
   - Verify API URL in `.env.production`
   - Check browser console for errors
   - Test build locally: `npm run build && npm run preview`

3. **Database Issues**:
   - Verify schema applied: `wrangler d1 execute neighborhood-db --remote --command "SELECT * FROM sqlite_master"`
   - Check data imported: `wrangler d1 execute neighborhood-db --remote --command "SELECT COUNT(*) FROM websites"`

**Full Rollback**:
- Keep local development environment working
- Delete Cloudflare deployments via dashboard if needed
- Re-deploy with fixes

### Phase 5 Status: ✅ COMPLETE (2025-11-11)

**All automated setup complete!** The application is fully configured for Cloudflare deployment.

#### What Was Implemented

**Data Layer:**
- ✅ Sample data imported to local SQLite (548 websites)
- ✅ Local D1 database initialized and populated
- ✅ Production data export script created (`export:production-data`)
- ✅ Database migration system ready

**Frontend Configuration:**
- ✅ Environment variable support (`.env.development`, `.env.production`)
- ✅ API URL configuration (`VITE_API_URL`)
- ✅ All API calls updated to use `getApiBaseUrl()`
- ✅ Cloudflare Pages configuration (`wrangler.toml`)
- ✅ Production build ready

**Backend Configuration:**
- ✅ Wrangler configuration already set up
- ✅ D1 database binding configured
- ✅ Deployment script ready (`npm run deploy:backend`)

**Deployment Scripts Created:**
- ✅ `npm run build:all` - Build both client and server
- ✅ `npm run build:client` - Build frontend only
- ✅ `npm run deploy:backend` - Deploy Workers API
- ✅ `npm run deploy:frontend` - Build + deploy Pages
- ✅ `npm run deploy:all` - Deploy everything
- ✅ `npm run export:production-data` - Export local data to SQL
- ✅ `npm run db:import-local` - Import to local D1 (for testing)

**Documentation Created:**
- ✅ `DEPLOY.md` - Comprehensive deployment guide
- ✅ `CLOUDFLARE_MANUAL_STEPS.md` - Step-by-step checklist
- ✅ Updated `IMPLEMENTATION.md` with Phase 5 details

**Files Created/Modified:**
- ✅ `packages/client/.env.development` - Dev API URL
- ✅ `packages/client/.env.production` - Prod API URL (template)
- ✅ `packages/client/src/vite-env.d.ts` - TypeScript env types
- ✅ `packages/client/wrangler.toml` - Pages deployment config
- ✅ `packages/shared/src/api.ts` - Environment-aware API client
- ✅ `packages/client/src/App.tsx` - Uses `getApiBaseUrl()`
- ✅ `packages/client/src/components/StartScreen.tsx` - Uses `getApiBaseUrl()`
- ✅ `packages/server/scripts/import-local-db.ts` - Fixed field mapping
- ✅ `scripts/data-pipeline/export-production.ts` - Production SQL export
- ✅ `package.json` - Added deployment scripts

#### Test Results

**Local Development Tested:**
- ✅ Sample data (548 websites) imported successfully
- ✅ Local D1 database populated and verified
- ✅ Environment variables working in dev mode
- ✅ API client correctly using localhost in development

**Production Export Tested:**
- ✅ Export script generates valid SQL
- ✅ File size: ~4-5 MB for 548 websites
- ✅ SQL syntax validated

#### Manual Steps Required by User

See **`CLOUDFLARE_MANUAL_STEPS.md`** for detailed instructions.

**Summary:**
1. 🔲 Create production D1 database: `wrangler d1 create neighborhood-db`
2. 🔲 Update `packages/server/wrangler.toml` with database ID
3. 🔲 Initialize production schema (2 commands)
4. 🔲 Import data to production D1 (1 command, 2-3 min)
5. 🔲 Deploy backend: `npm run deploy:backend`
6. 🔲 Copy Workers URL to `packages/client/.env.production`
7. 🔲 Deploy frontend: `npm run deploy:frontend`
8. 🔲 (Optional) Configure custom domain in dashboard

**Estimated time:** 15-20 minutes

#### Deployment Architecture

```
┌─────────────────────────────────────┐
│   Cloudflare Pages (Frontend)      │
│   - React + Three.js                │
│   - Vite build                      │
│   - URL: *.pages.dev                │
└─────────────┬───────────────────────┘
              │ HTTPS
              ↓
┌─────────────────────────────────────┐
│   Cloudflare Workers (Backend)      │
│   - Hono API                        │
│   - k-NN semantic search            │
│   - URL: *.workers.dev              │
└─────────────┬───────────────────────┘
              │ D1 Binding
              ↓
┌─────────────────────────────────────┐
│   Cloudflare D1 (Database)          │
│   - SQLite (548 websites)           │
│   - Embeddings (384-dim)            │
│   - Chunk cache                     │
└─────────────────────────────────────┘
```

#### Key Technical Decisions

**Environment Configuration:**
- Used Vite's built-in env var system (`import.meta.env`)
- Separate `.env.development` and `.env.production` files
- Runtime API URL detection in shared package
- Fallback to `/api` for Vite proxy in development

**Data Pipeline:**
- Export from local SQLite → SQL file → Import to production D1
- Handles NULL values correctly
- Escapes SQL strings properly
- Batched inserts for performance

**Deployment Strategy:**
- One-command builds: `npm run build:all`
- One-command deploys: `npm run deploy:all`
- Separate frontend/backend deploy scripts for flexibility
- Production data export as separate step (not automatic)

**Why This Approach:**
- Simple: No CI/CD setup required initially
- Flexible: Can deploy frontend/backend independently
- Safe: Production data export is manual to prevent accidents
- Fast: Cached builds, incremental deploys

#### Cost Analysis

**Cloudflare Free Tier (as of 2025):**
- Workers: 100,000 requests/day
- D1: 5GB storage, 5M reads/day, 100K writes/day
- Pages: Unlimited bandwidth, 500 builds/month

**Estimated Usage (548 websites):**
- Workers: 100-500 requests/day (low initial traffic)
- D1 Storage: ~2MB (well below 5GB)
- D1 Reads: ~500-1000/day (chunk lookups)
- D1 Writes: ~50-100/day (new placements, cache)
- Pages: Static hosting (free)

**Conclusion:** Should stay well within free tier indefinitely.

**Scaling Considerations:**
- At 10K websites: Still free tier
- At 100K websites: May need paid D1 ($0.50/month for extra storage)
- At 1M+ websites: Consider Cloudflare Vectorize for k-NN ($0.04 per 1M queries)

#### Next Steps After Deployment

**Immediate:**
- User executes manual Cloudflare steps
- Test deployment in browser
- Verify all functionality works

**Short-term Improvements:**
- Add monitoring/alerts in Cloudflare dashboard
- Set up custom domain
- Enable analytics
- Implement error tracking (Sentry, Cloudflare Insights)

**Long-term Scaling:**
- Expand dataset (548 → 10K → 100K+)
- Migrate to Cloudflare Vectorize for k-NN (at scale)
- Add caching layer (Cloudflare Cache API)
- Implement rate limiting
- Add authentication for admin features

#### Lessons Learned

**What Went Well:**
- Environment variable system works cleanly across dev/prod
- Cloudflare infrastructure well-suited for this use case
- One-command deployment scripts make iteration fast
- Local D1 development excellent for testing

**Challenges:**
- Schema mismatch between pipeline and server (fixed with field mapping)
- NULL handling in SQL export (fixed with escapeString helper)
- TypeScript types for environment variables (fixed with vite-env.d.ts)

**Best Practices Applied:**
- Separate config files for dev/prod
- Export functions for reusability (`getApiBaseUrl()`)
- Clear documentation with step-by-step instructions
- Progress indicators in scripts
- Verification commands after each step

---
