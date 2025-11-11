/**
 * Core type definitions for the 3D Neighborhood project
 */

/**
 * Building rendering type - determines visual appearance
 */
export enum BuildingType {
  NORMAL = 'normal',           // Standard building (white/black outline)
  NEW = 'new',                 // Newly generated this session (green outline)
  ANCHOR = 'anchor',           // Anchor/seed building (future: different color)
  HIGHLIGHTED = 'highlighted', // User-selected/targeted (future: different color)
}

/**
 * World configuration - all parameters needed for deterministic generation
 */
export interface WorldConfig {
  // Generation
  worldSeed: number;
  worldVersion: number;

  // Chunk layout
  chunkGridSize: number;          // 5x5 cells
  cellSize: number;               // Units per cell (30)
  buildingsPerChunk: number;      // 4x4 buildings (16)

  // Noise
  noiseScale: number;
  maxPositionOffset: number;      // ±8 units from grid center

  // Building size
  baseWidth: number;
  baseHeight: number;
  maxWidth: number;
  maxHeight: number;
  sizeNoiseVariation: number;     // ±20%

  // k-NN (mock for now)
  knnPerAnchor: number;
  maxAnchorsPerChunk: number;

  // Rendering
  fogStart: number;
  fogEnd: number;
  chunkLoadRadius: number;        // Load 3x3 chunks (1 in each direction)
  wireframeLineWidth: number;     // Width of building edges

  // Multiplayer
  positionUpdateIntervalMs: number;
}

/**
 * Building data within a chunk
 */
export interface BuildingData {
  url: string;
  gridX: number;                  // Grid cell (0-4)
  gridZ: number;
  worldX: number;                 // Actual position with noise offset
  worldZ: number;
  width: number;
  height: number;
}

/**
 * Complete chunk data - this is what gets cached in the database
 */
export interface ChunkData {
  chunkX: number;
  chunkZ: number;
  worldVersion: number;           // Generation algorithm version
  buildings: BuildingData[];
}

/**
 * Player state for multiplayer
 */
export interface PlayerState {
  id: string;
  x: number;
  z: number;
  rotation: number;               // Y-axis rotation only
  timestamp: number;
}

/**
 * Website metadata (from scraper)
 */
export interface WebsiteMetadata {
  url: string;
  title: string;
  description: string;
  popularityScore: number;
  embeddingDim?: number;          // Future-proof for model changes
  scrapedAt: string;              // ISO timestamp
}
