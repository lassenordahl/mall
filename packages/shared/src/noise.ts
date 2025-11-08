/**
 * Noise and randomness utilities
 * All functions are deterministic - same inputs always produce same outputs
 */

/**
 * Seeded random number generator using Linear Congruential Generator (LCG)
 * Returns a function that generates numbers in [0, 1)
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed;

  return function random(): number {
    // LCG parameters (from Numerical Recipes)
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);

    state = (a * state + c) % m;
    return state / m;
  };
}

/**
 * Hash a string to a number (for URL-based seeding)
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Hash coordinates to a deterministic seed
 */
export function hashCoords(x: number, z: number, seed: number): number {
  // Combine coordinates and seed using bit manipulation
  const h1 = x * 374761393;
  const h2 = z * 668265263;
  const h3 = seed * 2147483647;
  return Math.abs((h1 + h2 + h3) | 0);
}

/**
 * Perlin noise permutation table
 * This is the standard Perlin permutation, repeated twice
 */
const PERLIN_PERMUTATION = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
  36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
  234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
  88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
  134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
  230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
  1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
  116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
  124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
  47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
  154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
  108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
  242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
  239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
  50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
  141, 128, 195, 78, 66, 215, 61, 156, 180,
];

// Repeat the permutation table
const p = new Array(512);
for (let i = 0; i < 256; i++) {
  p[i] = p[i + 256] = PERLIN_PERMUTATION[i];
}

/**
 * Fade function for Perlin noise (6t^5 - 15t^4 + 10t^3)
 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation
 */
function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

/**
 * Gradient function for Perlin noise
 */
function grad(hash: number, x: number, y: number): number {
  // Convert low 4 bits of hash into 12 gradient directions
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * 2D Perlin noise
 * Returns value in approximately [-1, 1]
 *
 * @param x X coordinate
 * @param y Y coordinate
 * @param seed Seed for deterministic variation
 */
export function perlinNoise2D(x: number, y: number, seed: number = 0): number {
  // Add seed offset to coordinates
  x += (seed % 256) * 100;
  y += Math.floor(seed / 256) * 100;

  // Find unit grid cell containing point
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  // Get relative xy coordinates within cell
  x -= Math.floor(x);
  y -= Math.floor(y);

  // Compute fade curves
  const u = fade(x);
  const v = fade(y);

  // Hash coordinates of the 4 cube corners
  const A = p[X] + Y;
  const AA = p[A];
  const AB = p[A + 1];
  const B = p[X + 1] + Y;
  const BA = p[B];
  const BB = p[B + 1];

  // Blend results from 4 corners
  return lerp(
    v,
    lerp(u, grad(p[AA], x, y), grad(p[BA], x - 1, y)),
    lerp(u, grad(p[AB], x, y - 1), grad(p[BB], x - 1, y - 1))
  );
}

/**
 * Get a position offset using noise
 * Returns a value in [-maxOffset, maxOffset]
 */
export function getNoiseOffset(
  baseX: number,
  baseZ: number,
  seed: number,
  scale: number,
  maxOffset: number
): { offsetX: number; offsetZ: number } {
  const noiseX = perlinNoise2D(baseX * scale, baseZ * scale, seed);
  const noiseZ = perlinNoise2D(baseX * scale + 1000, baseZ * scale + 1000, seed + 1000);

  return {
    offsetX: noiseX * maxOffset,
    offsetZ: noiseZ * maxOffset,
  };
}

/**
 * Generate a deterministic size variation using noise
 * Returns a multiplier in [1 - variation, 1 + variation]
 */
export function getSizeVariation(
  x: number,
  z: number,
  seed: number,
  variation: number
): number {
  const noise = perlinNoise2D(x * 0.1, z * 0.1, seed);
  return 1 + (noise * variation);
}
