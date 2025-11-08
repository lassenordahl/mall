/**
 * Pure chunk generation function
 * Same inputs ALWAYS produce same outputs - no side effects
 */

import type { WorldConfig, ChunkData, BuildingData } from './types.js';
import { MOCK_WEBSITES } from './config.js';
import {
  hashCoords,
  hashString,
  createSeededRandom,
  getNoiseOffset,
  getSizeVariation,
} from './noise.js';

/**
 * Determine if a grid cell should be a road
 * Roads are just visual gaps in rendering - not stored data
 *
 * Pattern: Cross-shaped roads dividing the chunk into 4 quadrants
 * Middle row (2) and middle column (2) are roads
 * This creates a 5x5 grid with 16 buildings and 9 road cells
 */
function isRoadCell(gridX: number, gridZ: number): boolean {
  // Cross pattern: middle row and middle column are roads
  return gridX === 2 || gridZ === 2;
}

/**
 * Select a website for a building cell using mock similarity
 * Later this will be replaced with real vector search
 *
 * Uses deterministic hashing to pick from MOCK_WEBSITES
 */
function selectWebsite(
  chunkX: number,
  chunkZ: number,
  gridX: number,
  gridZ: number,
  config: WorldConfig
): string {
  // Create a deterministic seed from chunk coords, grid position, and world seed
  const seed = hashCoords(
    chunkX * 100 + gridX,
    chunkZ * 100 + gridZ,
    config.worldSeed
  );

  // Use seed to pick a website from the mock list
  const index = Math.abs(seed) % MOCK_WEBSITES.length;
  return MOCK_WEBSITES[index];
}

/**
 * Calculate building size based on URL (mock popularity) and noise variation
 */
function calculateBuildingSize(
  url: string,
  worldX: number,
  worldZ: number,
  config: WorldConfig
): { width: number; height: number } {
  // Mock popularity score based on URL hash (0-100)
  const urlHash = hashString(url);
  const mockPopularity = (urlHash % 100) / 100; // 0 to 1

  // Base size with popularity scaling
  // Popular sites get slightly larger buildings
  const popularityMultiplier = 1 + mockPopularity * 0.3; // 1.0 to 1.3

  // Apply noise variation
  const sizeVariation = getSizeVariation(
    worldX,
    worldZ,
    config.worldSeed,
    config.sizeNoiseVariation
  );

  // Calculate width (clamped to max)
  let width = config.baseWidth * popularityMultiplier * sizeVariation;
  width = Math.max(config.baseWidth, Math.min(width, config.maxWidth));

  // Calculate height with more dramatic variation
  // Height uses logarithmic scaling for popularity
  const heightPopularityMultiplier = 1 + Math.log(1 + mockPopularity * 10) / 2;
  let height = config.baseHeight * heightPopularityMultiplier * sizeVariation;
  height = Math.max(config.baseHeight, Math.min(height, config.maxHeight));

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Generate a chunk deterministically
 *
 * This is a PURE FUNCTION:
 * - No database queries
 * - No external API calls
 * - No mutable global state
 * - Same inputs ALWAYS produce same outputs
 *
 * @param cx Chunk X coordinate
 * @param cz Chunk Z coordinate
 * @param config World configuration
 * @returns Complete chunk data ready to cache
 */
export function generateChunk(
  cx: number,
  cz: number,
  config: WorldConfig
): ChunkData {
  const buildings: BuildingData[] = [];

  // Iterate through 5x5 grid
  for (let gridX = 0; gridX < config.chunkGridSize; gridX++) {
    for (let gridZ = 0; gridZ < config.chunkGridSize; gridZ++) {
      // Skip road cells
      if (isRoadCell(gridX, gridZ)) {
        continue;
      }

      // Calculate base grid position in world space
      const chunkOffsetX = cx * config.chunkGridSize * config.cellSize;
      const chunkOffsetZ = cz * config.chunkGridSize * config.cellSize;
      const baseWorldX = chunkOffsetX + gridX * config.cellSize;
      const baseWorldZ = chunkOffsetZ + gridZ * config.cellSize;

      // Apply noise offset for organic feel
      const seed = hashCoords(cx, cz, config.worldSeed);
      const { offsetX, offsetZ } = getNoiseOffset(
        baseWorldX,
        baseWorldZ,
        seed,
        config.noiseScale,
        config.maxPositionOffset
      );

      const worldX = baseWorldX + offsetX;
      const worldZ = baseWorldZ + offsetZ;

      // Select website for this building
      const url = selectWebsite(cx, cz, gridX, gridZ, config);

      // Calculate building size
      const { width, height } = calculateBuildingSize(
        url,
        worldX,
        worldZ,
        config
      );

      // Add building to chunk
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
    worldVersion: config.worldVersion,
    buildings,
  };
}

/**
 * Helper function to find a building by URL in a chunk
 */
export function findBuildingByUrl(
  chunk: ChunkData,
  url: string
): BuildingData | undefined {
  return chunk.buildings.find((b) => b.url === url);
}

/**
 * Helper function to get all buildings in a set of chunks
 */
export function getAllBuildings(chunks: ChunkData[]): BuildingData[] {
  return chunks.flatMap((chunk) => chunk.buildings);
}
