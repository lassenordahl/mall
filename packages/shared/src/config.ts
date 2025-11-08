/**
 * Default world configuration
 * All tunable parameters in one place for easy experimentation
 */

import type { WorldConfig } from './types.js';

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  // Generation
  worldSeed: 42,
  worldVersion: 1,

  // Chunk layout
  chunkGridSize: 5,               // 5x5 cells
  cellSize: 30,                   // Units per cell
  buildingsPerChunk: 16,          // 4x4 buildings (rest are roads)

  // Noise
  noiseScale: 0.1,
  maxPositionOffset: 8,           // ±8 units from grid center

  // Building size
  baseWidth: 15,
  baseHeight: 25,
  maxWidth: 28,
  maxHeight: 120,
  sizeNoiseVariation: 0.2,        // ±20%

  // k-NN (mock for now)
  knnPerAnchor: 15,
  maxAnchorsPerChunk: 3,

  // Rendering
  fogStart: 150,
  fogEnd: 300,
  chunkLoadRadius: 1,             // Load 3x3 chunks (1 in each direction)
  wireframeLineWidth: 4,          // Width of building edges (liminal aesthetic)

  // Multiplayer
  positionUpdateIntervalMs: 1000, // 1 Hz initially
};

/**
 * Mock website list for testing
 * Later this will be replaced with real data from the database
 */
export const MOCK_WEBSITES = [
  'nytimes.com',
  'washingtonpost.com',
  'theguardian.com',
  'bbc.com',
  'cnn.com',
  'techcrunch.com',
  'theverge.com',
  'arstechnica.com',
  'wired.com',
  'engadget.com',
  'github.com',
  'stackoverflow.com',
  'reddit.com',
  'twitter.com',
  'facebook.com',
  'youtube.com',
  'netflix.com',
  'spotify.com',
  'amazon.com',
  'ebay.com',
  'wikipedia.org',
  'medium.com',
  'dev.to',
  'hackernews.com',
  'producthunt.com',
  'dribbble.com',
  'behance.net',
  'figma.com',
  'notion.so',
  'slack.com',
  'discord.com',
  'twitch.tv',
  'instagram.com',
  'pinterest.com',
  'tumblr.com',
  'linkedin.com',
  'glassdoor.com',
  'indeed.com',
  'coursera.org',
  'udemy.com',
  'khanacademy.org',
  'duolingo.com',
  'quora.com',
  'medium.com',
  'substack.com',
  'patreon.com',
  'kickstarter.com',
  'indiegogo.com',
  'gofundme.com',
  'etsy.com',
];
