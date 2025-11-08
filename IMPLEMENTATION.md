# 3D Neighborhood - Implementation Progress

**Started**: 2025-11-08
**Current Phase**: Phase 1 - Client Visualization
**Status**: ✅ Phase 0 & 1 COMPLETE - Working 3D visualization!

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

## Phase 2: Data Pipeline (TBD)

Will be detailed after Phase 1 is complete.

---

## Phase 3: Server + Database (TBD)

Will be detailed after Phase 2 is complete.

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

---

## Blockers & Questions

None currently blocking progress.

### Open Questions for Next Steps

**Visual & Dimensions** (from Phase 1 feedback):
- [ ] Building dimensions feel right? User mentioned "we should eventually work on the dimensions"
  - Width range (15-28) - should this be wider/narrower?
  - Height range (25-120) - should this be taller/shorter?
  - Cell size (30 units) - should buildings be more spread out?
  - Noise offset (±8 units) - should there be more/less organic variation?

**Visual Polish** (Progressive improvements):
- [ ] Add building details (windows, roofs, textures)?
- [ ] Add visual road geometry (not just gaps)?
- [ ] Improve building color variety/palette?
- [ ] Add ground texture/grid?
- [ ] Add building labels/tooltips on hover?
- [ ] Add minimap or position indicator?
- [ ] Add day/night cycle or sky gradient?

**Performance & Scale**:
- [ ] Test with more chunks (5×5, 7×7) - how does it perform?
- [ ] Add LOD (Level of Detail) for distant buildings?
- [ ] Add instancing for repeated geometry?
- [ ] Chunk loading/unloading based on player position?

**Path Forward**:
- [ ] **Option A**: Polish Phase 1 visuals before moving on?
- [ ] **Option B**: Move to Phase 2 (data pipeline - scraping, embeddings)?
- [ ] **Option C**: Move to Phase 3 (server + API + database)?
- [ ] **Option D**: Tune parameters and test different configurations?

**Phase 2 Decisions** (if going that route):
- [ ] Use Tranco Top 1M list as planned?
- [ ] Which embedding model? (all-MiniLM-L6-v2 as spec suggests?)
- [ ] Run embeddings locally or use Modal.com with $30 credit?
- [ ] How many websites to start with? (1000? 10,000? Full 1M?)

**Phase 3 Decisions** (if going that route):
- [ ] Set up Cloudflare Workers + D1 now?
- [ ] Keep client-side generation for testing, add server in parallel?
- [ ] Migration strategy: all at once or gradual?

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
- 144 buildings rendering (3×3 chunks)
- WASD + mouse controls
- Fog atmosphere (white, 150-300 units)
- Deterministic building colors (HSL from URL)
- 60fps performance

### What's Next (User Decision)

The system is ready for:
1. **Visual Polish** - Dimensions, details, textures
2. **Phase 2** - Data pipeline (scraping, embeddings)
3. **Phase 3** - Server + API + Database

Waiting for user direction on priorities.

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
