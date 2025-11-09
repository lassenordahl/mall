# Scalability Analysis - Chunk Generation

**Last Updated:** 2025-11-09

---

## Current Performance (548 websites)

✅ **Working great** - all caps in place, fast generation times

| Metric | Value | Status |
|--------|-------|--------|
| Embeddings in memory | ~850KB (548 × 384-dim) | ✅ Fine |
| Adjacent chunk queries | 8 (parallel) | ✅ Fast (2-5ms cached) |
| k-NN anchor limit | 5 max | ✅ Capped |
| Similar sites per anchor | 10 | ✅ Capped |
| Total candidate URLs | ~50 max | ✅ Reasonable |
| Chunk generation time | 15-65ms | ✅ Fast |

---

## Scaling Caps & Limits

### 1. Adjacent Chunk Queries

**Current:**
```typescript
// Query up to 8 adjacent chunks (parallel)
const chunkQueries = adjacentCoords.map(...);
await Promise.all(chunkQueries); // Parallel!
```

**Caps:**
- ✅ **Fixed at 8 chunks** (can't grow - always 8 neighbors)
- ✅ **Parallel queries** (fast even with D1 latency)
- ✅ **Max 50 anchor URLs** returned (hard cap)

**Scalability:** ✅ **Won't grow** - always 8 neighbors max

---

### 2. k-NN Anchor Selection

**Current:**
```typescript
const MAX_KNN_ANCHORS = 5;
adjacentAnchors.slice(0, 5).map(anchor => findSimilarWebsites(...))
```

**Caps:**
- ✅ **Max 5 anchors** used for k-NN (from up to 50 available)
- ✅ **10 similar sites** per anchor (50 total max candidates)
- ✅ **Deduplication** reduces final count

**Scalability:** ✅ **Capped** - won't run more than 5 k-NN queries

---

### 3. In-Memory k-NN (Current Bottleneck)

**Current:**
```typescript
// Loads ALL embeddings into memory once
embeddingsCache = results.results.map(row => ({
  url: row.url,
  embedding: new Float32Array(row.embedding)
}));
```

**Performance by dataset size:**

| Dataset Size | Memory Usage | k-NN Time (1 query) | Status |
|--------------|--------------|---------------------|--------|
| **548 sites** | ~850KB | <10ms | ✅ Fast |
| 1,000 sites | ~1.5MB | ~15ms | ✅ OK |
| 10,000 sites | ~15MB | ~50ms | ⚠️ Slow |
| 100,000 sites | ~150MB | ~500ms | ❌ Too slow |
| 1,000,000 sites | ~1.5GB | ~5000ms | ❌ Won't work |

**Caps:**
- ⚠️ **No cap** on embedding count loaded
- ⚠️ **No indexed search** - brute force cosine similarity

**Scaling Path:**
1. **Up to 1K sites:** Current approach is fine ✅
2. **1K-10K sites:** Still works, but slower ⚠️
3. **10K+ sites:** Need **Cloudflare Vectorize** ❌

---

## Migration Path to 1M Websites

### Phase A: Up to 10K sites (Current Architecture)

**No changes needed** - current in-memory k-NN works fine

**Estimated performance:**
- k-NN query time: ~50ms per query
- Chunk generation: ~250ms (5 queries)
- Still acceptable ✅

---

### Phase B: 10K-100K sites (Hybrid Approach)

**Option 1: Add Caching**
```typescript
// Cache k-NN results in D1
const cacheKey = `knn:${anchorUrl}:k${k}`;
const cached = await db.prepare('SELECT result FROM knn_cache WHERE key = ?')...
```

**Option 2: Sample Embeddings**
```typescript
// Only load top N most popular sites into memory
const embeddings = await db.prepare(
  'SELECT url, embedding FROM websites ORDER BY popularity_score DESC LIMIT 5000'
)...
```

---

### Phase C: 100K+ sites (Migrate to Vectorize)

**Replace in-memory k-NN with Cloudflare Vectorize:**

```typescript
// Current (in-memory)
const similar = await findSimilarWebsites(db, anchor, k);

// Future (Vectorize)
const similar = await c.env.VECTORIZE.query(anchorEmbedding, {
  topK: k,
  returnMetadata: true
});
```

**Benefits:**
- ✅ Indexed vector search (millisecond queries)
- ✅ Scales to millions of vectors
- ✅ No memory limits

**Migration steps:**
1. Import embeddings to Vectorize index
2. Update `findSimilarWebsites()` to query Vectorize
3. Keep D1 for chunk caching
4. No client changes needed!

---

## Current Bottlenecks Summary

### ✅ Not a Problem (Capped)
- Adjacent chunk queries (parallel, fixed at 8)
- k-NN anchor count (max 5)
- Candidate URLs (max 50)

### ⚠️ Potential Issue (Scalable for now)
- In-memory k-NN (works up to ~10K sites)

### ❌ Will Need Changes (For 100K+ sites)
- Need Cloudflare Vectorize for indexed search

---

## Monitoring Checklist

Watch these metrics as you scale:

```typescript
// Add to chunk generation:
console.log(`Chunk generation took ${duration}ms`);
console.log(`k-NN query avg: ${avgKnnTime}ms`);
console.log(`Total embeddings in memory: ${embeddingsCache.length}`);
```

**Thresholds:**
- ⚠️ Chunk generation >100ms → Consider optimizations
- ❌ Chunk generation >500ms → Migrate to Vectorize
- ❌ Memory usage >100MB → Migrate to Vectorize

---

## Recommendations

### For Current 548 Sites:
✅ **No action needed** - all caps in place, performance is great

### Before Scaling to 1M:
1. Run full data pipeline (costs ~$1.60)
2. Test with 10K sites first
3. Benchmark chunk generation times
4. If >100ms, migrate to Vectorize

### Long-term Architecture:
- Keep current approach for development/testing
- Migrate to Vectorize when dataset grows
- Client code doesn't change (same API)
