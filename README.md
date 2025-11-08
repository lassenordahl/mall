# 3D Neighborhood

A shared, explorable 3D neighborhood where websites are represented as buildings, spatially organized by semantic similarity.

**Status**: Phase 0 Complete (Core generation logic)

---

## Quick Start

### Phase 0: Test Generation Logic

```bash
# Install dependencies
npm install

# Build shared package
cd packages/shared
npm run build
cd ../..

# Run generation tests
npm run test:generation
```

Expected output: All 11 tests pass ✓

### Inspect Generated Data

```bash
# View single chunk
cat test-chunk-single.json

# View 3x3 grid
cat test-chunks-3x3.json

# View summary statistics
cat test-summary.json
```

---

## Project Structure

```
/
├── packages/
│   └── shared/              # Shared TypeScript library
│       ├── src/
│       │   ├── types.ts     # Type definitions
│       │   ├── config.ts    # Configuration constants
│       │   ├── noise.ts     # Perlin noise + RNG
│       │   └── generation.ts # Pure chunk generation
│       └── dist/            # Compiled output
│
├── scripts/
│   └── test-generation.ts   # Test suite
│
├── IMPLEMENTATION.md         # Detailed implementation log
└── PROJECT_SPEC.md          # Full project specification
```

---

## Architecture

### Deterministic Generation

All chunk generation is **deterministic** - same inputs always produce same outputs:

```typescript
import { generateChunk, DEFAULT_WORLD_CONFIG } from '@3d-neighborhood/shared';

const chunk = generateChunk(0, 0, DEFAULT_WORLD_CONFIG);
// Always produces the same 16 buildings in the same positions
```

### Key Principles

1. **Pure Functions**: No side effects, no database queries during generation
2. **JSON-Serializable Types**: Ready for API/network transmission
3. **Shared Code**: Same generation logic will run client-side and server-side
4. **Configurable**: All parameters in one place (`packages/shared/config.ts`)

### Chunk Layout

- **Grid**: 5×5 cells, 30 units per cell = 150×150 unit chunks
- **Buildings**: 16 per chunk (4×4 grid)
- **Roads**: Cross pattern (center row/col) divides chunk into quadrants
- **Positioning**: Perlin noise adds ±8 unit offset for organic feel
- **Sizes**: Width 15-28 units, Height 25-120 units (based on mock popularity + noise)

---

## Development

### Running Tests

```bash
npm run test:generation
```

### Modifying Parameters

Edit `packages/shared/src/config.ts` to adjust:
- World seed
- Noise scale
- Building size ranges
- Grid dimensions
- etc.

Then rebuild and test:
```bash
cd packages/shared && npm run build && cd ../..
npm run test:generation
```

### Type Safety

All types are in `packages/shared/src/types.ts`:
- `WorldConfig` - Configuration for generation
- `ChunkData` - Output of generation (cacheable)
- `BuildingData` - Individual building info

These types are designed to work across:
- Client-side generation
- Server-side generation
- API transmission
- Database storage

---

## Next Steps

See `IMPLEMENTATION.md` for:
- Phase 1: Client-side 3D visualization (React + Three.js)
- Phase 2: Data pipeline (scraping, embeddings)
- Phase 3: Server + Database (Cloudflare Workers + D1)
- Phase 4+: Real-time multiplayer, vector search, polish

---

## Documentation

- `IMPLEMENTATION.md` - Living implementation log with testing checkpoints
- `/specs` - Design specifications (authoritative)
- `packages/shared/src/` - Inline code documentation

**Note**: The `/specs` directory contains fully iterated design documents that represent the source of truth for project direction.

---

## License

TBD
