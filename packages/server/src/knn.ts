/**
 * In-memory k-NN semantic similarity search
 * For 548 websites (~850KB of embeddings), this is very fast
 */

export interface Website {
  url: string;
  embedding: Float32Array;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Cache for loaded embeddings (reused across requests)
 */
let embeddingsCache: Website[] | null = null;

/**
 * Load all embeddings into memory once
 */
async function loadAllEmbeddings(db: D1Database): Promise<Website[]> {
  if (embeddingsCache) {
    return embeddingsCache;
  }

  const results = await db
    .prepare('SELECT url, embedding FROM websites WHERE embedding IS NOT NULL')
    .all<{ url: string; embedding: ArrayBuffer }>();

  embeddingsCache = results.results.map((row) => ({
    url: row.url,
    embedding: new Float32Array(row.embedding),
  }));

  console.log(`Loaded ${embeddingsCache.length} embeddings into memory`);
  return embeddingsCache;
}

/**
 * Find k most similar websites to the anchor URL
 */
export async function findSimilarWebsites(
  db: D1Database,
  anchorUrl: string,
  k: number
): Promise<string[]> {
  // Get anchor embedding
  const anchorRow = await db
    .prepare('SELECT embedding FROM websites WHERE url = ?')
    .bind(anchorUrl)
    .first<{ embedding: ArrayBuffer }>();

  if (!anchorRow || !anchorRow.embedding) {
    console.warn(`No embedding found for anchor: ${anchorUrl}`);
    // Return random websites as fallback
    const fallback = await db
      .prepare('SELECT url FROM websites LIMIT ?')
      .bind(k)
      .all<{ url: string }>();
    return fallback.results.map((r) => r.url);
  }

  const anchorVec = new Float32Array(anchorRow.embedding);

  // Load all embeddings
  const allWebsites = await loadAllEmbeddings(db);

  // Compute similarities
  const similarities = allWebsites
    .filter((site) => site.url !== anchorUrl) // Exclude anchor itself
    .map((site) => ({
      url: site.url,
      similarity: cosineSimilarity(anchorVec, site.embedding),
    }));

  // Sort by similarity (descending) and take top-k
  similarities.sort((a, b) => b.similarity - a.similarity);

  return similarities.slice(0, k).map((s) => s.url);
}

/**
 * Get multiple anchors and combine their neighbors
 * Used when generating chunks based on adjacent chunks
 */
export async function findSimilarFromAnchors(
  db: D1Database,
  anchorUrls: string[],
  k: number
): Promise<string[]> {
  // Get neighbors for each anchor
  const allNeighbors = await Promise.all(
    anchorUrls.map((anchor) => findSimilarWebsites(db, anchor, k))
  );

  // Flatten and deduplicate
  const seen = new Set<string>();
  const result: string[] = [];

  for (const neighbors of allNeighbors) {
    for (const url of neighbors) {
      if (!seen.has(url) && result.length < k * anchorUrls.length) {
        seen.add(url);
        result.push(url);
      }
    }
  }

  return result;
}
