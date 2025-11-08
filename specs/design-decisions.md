# Design Decisions - Answered Questions

**Date**: 2025-10-26  
**Phase**: Architecture Finalization

---

## Visual & Rendering Decisions

### Noise Function
**Decision**: **Perlin Noise**

**Implementation**:
```typescript
// packages/shared/noise.ts
export function perlinNoise2D(x: number, y: number, seed: number): number {
  // Standard Perlin implementation
  // Returns value in [-1, 1]
}

// Building position offset
const offsetX = perlinNoise2D(baseX, baseZ, urlHash) * MAX_OFFSET;
const offsetZ = perlinNoise2D(baseX + 1000, baseZ, urlHash) * MAX_OFFSET;
```

### Ground Texture
**Decision**: **White (#FFFFFF)**
- Simple solid color initially
- Modular - can swap texture later without touching generation logic

### Skybox
**Decision**: **White (#FFFFFF)**
- Minimal/clean aesthetic
- Easy to replace with gradient or detailed skybox later
- Modular implementation

### Player Avatars
**Decision**: **Everyone starts as a cube**
- Simple geometry (BoxGeometry)
- Future: IP-based identification → custom avatar upload
- No authentication required initially

**IP-Based Identity (Future)**:
```typescript
// Optional future feature
interface PlayerProfile {
  ip_hash: string;  // Hashed IP for privacy
  avatar_url?: string;  // R2/CDN link to uploaded image
  display_name?: string;
}
```

---

## Data & Content Decisions

### Website Dataset
**Decision**: **Tranco Top 1M List**
- Source: https://tranco-list.eu/
- Size: 1,000,000 websites
- Well-maintained, research-grade ranking

### Embedding Model - Local LLM Options

**Recommended: Sentence Transformers (Free, runs locally)**

| Model | Dimensions | Speed | Quality | Cost |
|-------|-----------|-------|---------|------|
| **all-MiniLM-L6-v2** | 384 | Very Fast | Good | FREE (local) |
| **all-mpnet-base-v2** | 768 | Medium | Better | FREE (local) |
| **e5-small-v2** | 384 | Fast | Good | FREE (local) |

**For 1M websites**:
- Processing time: ~2-4 hours on laptop (with batching)
- Memory: ~4-8 GB RAM
- Storage: ~1.5 GB (384-dim) or ~3 GB (768-dim)
- **Total cost: $0**

**If using Modal with $30 credit**:

Option 1: **Use Modal GPU for faster processing**
```python
# Modal.com example (A10G GPU)
# Cost: ~$0.60/hour
# Time: ~15-30 minutes for 1M websites
# Total: ~$0.30 for entire dataset

import modal
from sentence_transformers import SentenceTransformer

stub = modal.Stub("embedding-generator")

@stub.function(gpu="A10G", timeout=3600)
def generate_embeddings(urls: list[str]) -> list[list[float]]:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(urls, batch_size=256, show_progress_bar=True)
    return embeddings.tolist()
```

Option 2: **Ultra-cheap OpenAI embeddings**
- Model: `text-embedding-3-small` (1536-dim)
- Cost: $0.02 per 1M tokens
- 1M websites × ~10 tokens avg = ~10M tokens = **$0.20 total**
- Faster API, but vendor lock-in

**Recommendation**: **Sentence Transformers locally** (free, full control, good quality)

### Scraping Strategy

**Decision**: **One-time batch scrape with re-run tooling**

**Architecture**:
```
scripts/scraper/
├─ scrape.ts           # Fetch website metadata
├─ embed.ts            # Generate embeddings
├─ config.json         # Scraping parameters
└─ output/
    ├─ metadata.jsonl  # Raw scraped data
    └─ embeddings.bin  # Binary embedding file
```

**Re-run Workflow**:
```bash
# Change K-means config, world seed, etc.
npm run scrape:clean       # Clear old data
npm run scrape:fetch       # Re-scrape metadata
npm run scrape:embed       # Re-generate embeddings
npm run import:vectorize   # Upload to Vectorize
npm run world:reset        # Clear D1 chunks, bump world_version
```

**Modular Design**:
- Each step outputs to files (can skip steps)
- Config-driven (easy to experiment)
- Idempotent (can re-run safely)

---

## Generation Algorithm Decisions

### K-Nearest Neighbors per Anchor

**Decision**: **Configurable, default ~chunk size**

**Configuration**:
```typescript
// packages/shared/config.ts
export const GENERATION_CONFIG = {
  CHUNK_GRID_SIZE: 5,           // 5×5 cells
  BUILDINGS_PER_CHUNK: 16,      // 4×4 buildings (rest are roads)
  KNN_PER_ANCHOR: 15,           // Tunable parameter
  MAX_ANCHORS_PER_CHUNK: 3,     // Use 3 adjacent buildings as anchors
};

// In generation logic
const candidates = anchors.flatMap(anchor => 
  findKNearestNeighbors(anchor.url, GENERATION_CONFIG.KNN_PER_ANCHOR)
);
```

**Rationale**:
- `k=15` gives 3 anchors × 15 = 45 candidates for 16 buildings
- Allows filtering/deduplication
- Easy to tune via config

**Testing Different Values**:
```bash
# Regenerate world with different k
KNN_VALUE=20 npm run world:regenerate
```

---

## Implementation Phase Order

### Proposed Order (with Testing Strategy)

#### **Phase 0: Shared Foundation (Test Locally)**
**Goal**: Get deterministic generation working offline, visually verify it feels right

**Components**:
1. `packages/shared/noise.ts` - Perlin implementation
2. `packages/shared/generation.ts` - Pure chunk generation function
3. `packages/shared/config.ts` - All tunable parameters
4. **Test script**: `scripts/test-generation.ts`

**Test Script**:
```typescript
// Generate chunks with mock data, output to JSON
const chunks = [
  generateChunk(0, 0, mockConfig),
  generateChunk(1, 0, mockConfig),
  generateChunk(0, 1, mockConfig),
];

// Write to file for visual inspection
fs.writeFileSync('test-chunks.json', JSON.stringify(chunks, null, 2));

// Assertions
assert(chunks[0].buildings.length === 16, "Should have 16 buildings");
assert(determinismTest(), "Same inputs = same outputs");
```

**Success Criteria**:
- ✅ Pure function works (no crashes)
- ✅ Deterministic (same seed = same output)
- ✅ Correct building count per chunk
- ✅ Noise offsets within bounds (±8 units)

---

#### **Phase 1: Client-Only Visualization (No Server)**
**Goal**: See the world generation in 3D, verify visual feel, tune parameters

**Components**:
1. `packages/client` - Basic React + Three.js app
2. Import `packages/shared/generation.ts` directly
3. Generate chunks client-side (no API calls)
4. WASD movement + fog

**File**: `packages/client/src/App.tsx`
```tsx
import { generateChunk } from '@shared/generation';
import { Canvas } from '@react-three/fiber';

function App() {
  // Generate 3×3 chunks around origin
  const chunks = useMemo(() => {
    const result = [];
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        result.push(generateChunk(x, z, mockConfig));
      }
    }
    return result;
  }, []);

  return (
    <Canvas>
      <World chunks={chunks} />
    </Canvas>
  );
}
```

**Testing**:
```bash
cd packages/client
npm run dev
# Open browser, walk around with WASD
# Verify: Buildings look good, noise feels organic, fog works
```

**Success Criteria**:
- ✅ Chunks render correctly
- ✅ Building positions look organic (not too grid-like)
- ✅ Movement feels smooth
- ✅ Fog hides distant chunks
- ✅ Can tune `config.ts` and see changes immediately

**Tuning Loop**:
1. Adjust `MAX_OFFSET`, `NOISE_SCALE`, `KNN_PER_ANCHOR` in config
2. Refresh browser (hot reload)
3. Walk around, evaluate feel
4. Repeat until satisfied

---

#### **Phase 2: Data Pipeline (Offline)**
**Goal**: Scrape real data, generate real embeddings, prepare for server

**Components**:
1. `scripts/scraper/fetch-tranco.ts` - Download Tranco list
2. `scripts/scraper/scrape-metadata.ts` - Scrape 1M sites
3. `scripts/scraper/generate-embeddings.ts` - Sentence Transformers
4. Output to `scripts/scraper/output/`

**Workflow**:
```bash
# 1. Download Tranco list
npm run scraper:fetch-tranco
# Output: tranco-top-1m.csv

# 2. Scrape metadata (takes ~hours, parallelized)
npm run scraper:metadata
# Output: metadata.jsonl (1M lines)

# 3. Generate embeddings (local or Modal)
npm run scraper:embed
# Output: embeddings.bin (binary file, ~1.5 GB)

# 4. Validate
npm run scraper:validate
# Checks: All URLs have embeddings, no NaNs, correct dimensions
```

**Testing**:
```bash
# Test with small sample first
SAMPLE_SIZE=1000 npm run scraper:metadata
SAMPLE_SIZE=1000 npm run scraper:embed

# Verify output format
node scripts/test-data-format.ts
```

**Success Criteria**:
- ✅ 1M URLs scraped successfully (or X% success rate documented)
- ✅ Embeddings generated for all valid URLs
- ✅ Files ready for database import
- ✅ Can re-run pipeline to regenerate data

---

#### **Phase 3: Server + Database (API Only)**
**Goal**: Deploy server, cache chunks in D1, serve via API

**Components**:
1. `packages/server` - Hono API
2. D1 database with schema
3. Chunk generation endpoint
4. Data import script

**Workflow**:
```bash
# 1. Create D1 database
wrangler d1 create neighborhood-db
wrangler d1 execute neighborhood-db --file=schema.sql

# 2. Import scraped data
npm run import:websites
# Reads metadata.jsonl → inserts into D1 websites table

# 3. Deploy server
cd packages/server
wrangler deploy

# 4. Test API
curl https://your-worker.workers.dev/api/chunks/0/0
# Should return ChunkData JSON
```

**Testing**:
```bash
# Unit test generation with real data
npm run test:generation

# API integration tests
npm run test:api
# Tests: Chunk caching, determinism, error handling
```

**Success Criteria**:
- ✅ Server deployed to Cloudflare
- ✅ D1 contains 1M websites
- ✅ `/api/chunks/:cx/:cz` returns valid ChunkData
- ✅ Chunks are cached (subsequent requests fast)
- ✅ Generation uses real website data (not mocks)

---

#### **Phase 4: Client-Server Integration**
**Goal**: Client fetches from server, caches locally, multiplayer position sync

**Components**:
1. Update client to fetch from API (remove client-side generation)
2. IndexedDB chunk caching
3. Player position polling (1-2 Hz)
4. Entry point system

**Workflow**:
```bash
# 1. Update client to use API
# Remove: import { generateChunk } from '@shared/generation'
# Add: useChunks hook that fetches from server

# 2. Deploy client
cd packages/client
npm run build
wrangler pages deploy dist

# 3. Test end-to-end
# Open deployed URL, enter website, walk around
```

**Testing**:
```bash
# Manual testing checklist:
- [ ] Enter "nytimes.com" → spawns at correct building
- [ ] Walk in any direction → new chunks load
- [ ] Close browser, reopen → chunks load from IndexedDB (instant)
- [ ] Open in 2 browsers → see each other's position updates
```

**Success Criteria**:
- ✅ Client fetches chunks from server
- ✅ Chunks cached in IndexedDB (fast reload)
- ✅ Player position syncs between clients
- ✅ Entry point spawns at correct building
- ✅ Feels smooth and responsive

---

#### **Phase 5: Vector Search Integration**
**Goal**: Replace mock similarity with real k-NN queries

**Components**:
1. Import embeddings to Vectorize
2. Update `generation.ts` to query Vectorize
3. Regenerate world with new algorithm (bump world_version)

**Workflow**:
```bash
# 1. Create Vectorize index
wrangler vectorize create neighborhood-embeddings \
  --dimensions=384 \
  --metric=cosine

# 2. Import embeddings
npm run import:vectorize
# Reads embeddings.bin → uploads to Vectorize

# 3. Update generation to use Vectorize
# Modify generateChunk() to call env.VECTORIZE.query()

# 4. Bump world version
npm run world:reset
# Clears all chunks, increments world_version

# 5. Redeploy
wrangler deploy
```

**Testing**:
```bash
# Test k-NN queries
npm run test:vectorize
# Verify: Similar sites are actually semantically close

# Visual verification:
# Enter "nytimes.com" → nearby buildings should be news sites
# Walk toward "techcrunch.com" area → should transition to tech sites
```

**Success Criteria**:
- ✅ Vectorize contains 1M embeddings
- ✅ k-NN queries return relevant results
- ✅ Generated neighborhoods make semantic sense
- ✅ World feels coherent (news sites clustered, etc.)

---

#### **Phase 6: Polish & Optimization**
**Goal**: Visual improvements, performance tuning, UX

**Components**:
1. Building visual variety (deterministic textures/colors)
2. LOD system for distant buildings
3. Instanced rendering for performance
4. UI improvements (minimap, building labels, etc.)

**These are incremental improvements, not blocking**

---

### **Recommended Testing Order**

```
Phase 0 (Test Script)
  ↓ Verify generation logic works
Phase 1 (Client-Only)
  ↓ Verify visual feel is good
Phase 2 (Data Pipeline)
  ↓ Verify real data is correct
Phase 3 (Server API)
  ↓ Verify caching works
Phase 4 (Integration)
  ↓ Verify end-to-end flow
Phase 5 (Vector Search)
  ↓ Verify semantic coherence
Phase 6 (Polish)
```

**Key Insight**: Each phase is **independently testable** and **incrementally deployable**. You can stop at any phase and have a working system.

---

## Configuration System

**All tunable parameters in one place**:

```typescript
// packages/shared/config.ts
export const WORLD_CONFIG = {
  // Generation
  WORLD_SEED: 42,
  WORLD_VERSION: 1,
  
  // Chunk layout
  CHUNK_GRID_SIZE: 5,          // 5×5 cells
  CELL_SIZE: 30,               // Units per cell
  BUILDINGS_PER_CHUNK: 16,     // 4×4 buildings
  
  // Noise
  NOISE_SCALE: 0.1,
  MAX_POSITION_OFFSET: 8,      // ±8 units from grid center
  
  // Building size
  BASE_WIDTH: 15,
  BASE_HEIGHT: 25,
  MAX_WIDTH: 28,
  MAX_HEIGHT: 120,
  SIZE_NOISE_VARIATION: 0.2,   // ±20%
  
  // k-NN
  KNN_PER_ANCHOR: 15,
  MAX_ANCHORS_PER_CHUNK: 3,
  
  // Rendering
  FOG_START: 150,
  FOG_END: 300,
  CHUNK_LOAD_RADIUS: 1,        // Load 3×3 chunks (1 in each direction)
  
  // Multiplayer
  POSITION_UPDATE_INTERVAL_MS: 1000,  // 1 Hz initially
};
```

**Easy experimentation**:
```bash
# Try different noise scales
sed -i 's/NOISE_SCALE: 0.1/NOISE_SCALE: 0.2/' packages/shared/config.ts
npm run dev  # See changes immediately
```

---

## Open Questions for Later

### Authentication & Avatars
- [ ] IP-based identification implementation details
- [ ] Avatar upload system (R2 storage)
- [ ] Moderation strategy for uploaded images
- [ ] Privacy concerns with IP hashing

### Performance
- [ ] Exact LOD distance thresholds
- [ ] Instancing strategy (when to use)
- [ ] Chunk unloading strategy (memory management)

### Visual Polish
- [ ] Building texture details
- [ ] Window patterns
- [ ] Ground/road texture styles
- [ ] Skybox gradient or image

**These can be decided during implementation based on what feels right**

