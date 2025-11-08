/**
 * Test script for chunk generation
 * Verifies determinism, correctness, and outputs data for visual inspection
 */

import { writeFileSync } from 'fs';
import { generateChunk, DEFAULT_WORLD_CONFIG } from '../packages/shared/src/index.js';
import type { ChunkData, WorldConfig } from '../packages/shared/src/index.js';

// Colors for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`${GREEN}✓${RESET} ${message}`);
    testsPassed++;
  } else {
    console.log(`${RED}✗${RESET} ${message}`);
    testsFailed++;
  }
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log('\n==========================================');
console.log('3D Neighborhood - Generation Tests');
console.log('==========================================\n');

// Test 1: Determinism
console.log('Test 1: Determinism');
console.log('-------------------');
const config: WorldConfig = { ...DEFAULT_WORLD_CONFIG, worldSeed: 42 };
const chunk1 = generateChunk(0, 0, config);
const chunk2 = generateChunk(0, 0, config);
assert(
  deepEqual(chunk1, chunk2),
  'Same inputs produce identical chunks (determinism)'
);
console.log();

// Test 2: Building Count
console.log('Test 2: Building Count');
console.log('----------------------');
const chunk = generateChunk(0, 0, config);
assert(
  chunk.buildings.length === 16,
  `Chunk has correct number of buildings (expected 16, got ${chunk.buildings.length})`
);
console.log();

// Test 3: Position Bounds
console.log('Test 3: Position Bounds');
console.log('-----------------------');
const maxOffset = config.maxPositionOffset;
const cellSize = config.cellSize;
let allPositionsValid = true;
let outOfBoundsCount = 0;

chunk.buildings.forEach((building, i) => {
  // Calculate expected grid center
  const expectedCenterX = building.gridX * cellSize;
  const expectedCenterZ = building.gridZ * cellSize;

  // Check offset from grid center
  const actualOffsetX = Math.abs(building.worldX - expectedCenterX);
  const actualOffsetZ = Math.abs(building.worldZ - expectedCenterZ);

  if (actualOffsetX > maxOffset || actualOffsetZ > maxOffset) {
    allPositionsValid = false;
    outOfBoundsCount++;
    console.log(
      `  Building ${i} (${building.url}): offset (${actualOffsetX.toFixed(
        2
      )}, ${actualOffsetZ.toFixed(2)}) exceeds max ${maxOffset}`
    );
  }
});

assert(
  allPositionsValid,
  `All building positions within offset bounds (±${maxOffset} units)`
);
if (outOfBoundsCount > 0) {
  console.log(`  ${RED}Found ${outOfBoundsCount} buildings out of bounds${RESET}`);
}
console.log();

// Test 4: Building Size Bounds
console.log('Test 4: Building Size Bounds');
console.log('----------------------------');
let allSizesValid = true;
let invalidSizeCount = 0;

chunk.buildings.forEach((building, i) => {
  const widthValid =
    building.width >= config.baseWidth && building.width <= config.maxWidth;
  const heightValid =
    building.height >= config.baseHeight && building.height <= config.maxHeight;

  if (!widthValid || !heightValid) {
    allSizesValid = false;
    invalidSizeCount++;
    console.log(
      `  Building ${i} (${building.url}): width=${building.width} (${
        config.baseWidth
      }-${config.maxWidth}), height=${building.height} (${config.baseHeight}-${
        config.maxHeight
      }) ${!widthValid ? 'WIDTH INVALID' : ''} ${
        !heightValid ? 'HEIGHT INVALID' : ''
      }`
    );
  }
});

assert(
  allSizesValid,
  `All building sizes within bounds (width: ${config.baseWidth}-${config.maxWidth}, height: ${config.baseHeight}-${config.maxHeight})`
);
if (invalidSizeCount > 0) {
  console.log(`  ${RED}Found ${invalidSizeCount} buildings with invalid sizes${RESET}`);
}
console.log();

// Test 5: Different Seeds = Different Worlds
console.log('Test 5: Different Seeds = Different Worlds');
console.log('------------------------------------------');
const config2 = { ...DEFAULT_WORLD_CONFIG, worldSeed: 99 };
const chunk3 = generateChunk(0, 0, config);
const chunk4 = generateChunk(0, 0, config2);
assert(
  !deepEqual(chunk3, chunk4),
  'Different seeds produce different chunks'
);
console.log();

// Test 6: Adjacent Chunks
console.log('Test 6: Adjacent Chunks (3x3 grid)');
console.log('-----------------------------------');
const chunks: ChunkData[] = [];
for (let x = -1; x <= 1; x++) {
  for (let z = -1; z <= 1; z++) {
    chunks.push(generateChunk(x, z, config));
  }
}
assert(chunks.length === 9, 'Generated 3x3 grid of chunks (9 total)');

const totalBuildings = chunks.reduce((sum, c) => sum + c.buildings.length, 0);
assert(
  totalBuildings === 9 * 16,
  `Total buildings across 9 chunks = ${totalBuildings} (expected ${9 * 16})`
);
console.log();

// Test 7: Chunk Metadata
console.log('Test 7: Chunk Metadata');
console.log('----------------------');
assert(chunk.chunkX === 0, 'Chunk X coordinate is correct');
assert(chunk.chunkZ === 0, 'Chunk Z coordinate is correct');
assert(
  chunk.worldVersion === config.worldVersion,
  `World version is correct (${chunk.worldVersion})`
);
console.log();

// Test 8: No Road Cells
console.log('Test 8: No Road Cells in Building List');
console.log('---------------------------------------');
const hasRoadCells = chunk.buildings.some(
  (b) => b.gridX === 2 || b.gridZ === 2
);
assert(!hasRoadCells, 'No buildings placed on road cells (cross pattern - row/col 2)');
console.log();

// Test 9: URL Uniqueness in Chunk
console.log('Test 9: URL Uniqueness');
console.log('----------------------');
const urls = chunk.buildings.map((b) => b.url);
const uniqueUrls = new Set(urls);
console.log(
  `  Total buildings: ${urls.length}, Unique URLs: ${uniqueUrls.size}`
);
// Note: URLs may repeat in mock data, this is expected
console.log(`  ${YELLOW}ℹ${RESET} URL repetition is expected with mock data`);
console.log();

// Output test data to file
console.log('Generating Output Files');
console.log('-----------------------');

// Single chunk for detailed inspection
writeFileSync(
  'test-chunk-single.json',
  JSON.stringify(chunk, null, 2),
  'utf-8'
);
console.log(`${GREEN}✓${RESET} Written test-chunk-single.json`);

// 3x3 grid for spatial inspection
writeFileSync('test-chunks-3x3.json', JSON.stringify(chunks, null, 2), 'utf-8');
console.log(`${GREEN}✓${RESET} Written test-chunks-3x3.json`);

// Summary data
const summary = {
  config: {
    worldSeed: config.worldSeed,
    worldVersion: config.worldVersion,
    chunkGridSize: config.chunkGridSize,
    buildingsPerChunk: config.buildingsPerChunk,
  },
  singleChunk: {
    chunkX: chunk.chunkX,
    chunkZ: chunk.chunkZ,
    buildingCount: chunk.buildings.length,
    uniqueUrls: uniqueUrls.size,
    sizeRange: {
      width: {
        min: Math.min(...chunk.buildings.map((b) => b.width)),
        max: Math.max(...chunk.buildings.map((b) => b.width)),
        avg:
          chunk.buildings.reduce((sum, b) => sum + b.width, 0) /
          chunk.buildings.length,
      },
      height: {
        min: Math.min(...chunk.buildings.map((b) => b.height)),
        max: Math.max(...chunk.buildings.map((b) => b.height)),
        avg:
          chunk.buildings.reduce((sum, b) => sum + b.height, 0) /
          chunk.buildings.length,
      },
    },
  },
  gridTest: {
    chunksGenerated: chunks.length,
    totalBuildings,
    averageBuildingsPerChunk: totalBuildings / chunks.length,
  },
};

writeFileSync('test-summary.json', JSON.stringify(summary, null, 2), 'utf-8');
console.log(`${GREEN}✓${RESET} Written test-summary.json`);
console.log();

// Final Summary
console.log('==========================================');
console.log('Test Results');
console.log('==========================================');
console.log(`${GREEN}Passed: ${testsPassed}${RESET}`);
console.log(`${RED}Failed: ${testsFailed}${RESET}`);
console.log();

if (testsFailed === 0) {
  console.log(`${GREEN}All tests passed! ✓${RESET}`);
  console.log();
  console.log('Next steps:');
  console.log('1. Review test-chunk-single.json to see a single chunk');
  console.log('2. Review test-chunks-3x3.json to see chunk alignment');
  console.log('3. Review test-summary.json for statistics');
  console.log('4. If everything looks good, proceed to Phase 1 (client visualization)');
  console.log();
  process.exit(0);
} else {
  console.log(`${RED}Some tests failed. Please fix issues before proceeding.${RESET}`);
  console.log();
  process.exit(1);
}
