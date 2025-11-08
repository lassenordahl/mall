# Data Collection Pipeline

This directory contains scripts to collect, process, and store website data for the 3D Neighborhood project.

## Overview

The pipeline collects data from the Tranco Top 1M list, scrapes metadata, generates semantic embeddings, and stores everything in a local SQLite database.

**Total Cost:** ~$2 using Modal.com (well under the $30 credit)
**Total Time:** ~20-30 minutes for 1M websites

## Architecture

```
1. Download Tranco list (CSV)
   ↓
2. Scrape metadata (Modal - parallel scraping)
   ↓
3. Generate embeddings (Modal - GPU acceleration)
   ↓
4. Import to SQLite (local database)
   ↓
5. Ready for chunk generation!
```

## Prerequisites

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Modal

Modal is required for parallel scraping and GPU-accelerated embeddings.

**First time setup:**

```bash
# Install Modal CLI
pip install modal

# Login to Modal (you'll get $30 free credit)
modal token new
```

This will open a browser for authentication. Once logged in, you're ready to go!

## Pipeline Steps

### Step 1: Initialize Database

Create the SQLite database with proper schema:

```bash
npm run data:init-db
```

**Output:** `scripts/data-pipeline/output/neighborhood.db`

### Step 2: Download Tranco List

Download the Top 1M website rankings:

```bash
npm run data:download-tranco
```

**Output:** `scripts/data-pipeline/output/tranco-top-1m.csv` (~15 MB)

### Step 3: Scrape Metadata (Modal)

**For testing (1,000 websites):**

```bash
npm run data:scrape-sample
```

- **Time:** ~1-2 minutes
- **Cost:** ~$0.02
- **Output:** `scripts/data-pipeline/output/metadata-sample.jsonl`

**For production (1M websites):**

```bash
npm run data:scrape-full
```

- **Time:** ~10-15 minutes
- **Cost:** ~$0.60
- **Output:** `scripts/data-pipeline/output/metadata-full.jsonl`

**What it scrapes:**
- Website title (from `<title>` tag)
- Description (from meta tags)
- Handles redirects, timeouts, and errors gracefully

**Expected success rate:** 85-90% (many sites are dead, paywalled, or block bots)

### Step 4: Generate Embeddings (Modal GPU)

**For testing (sample):**

```bash
npm run data:embed-sample
```

- **Time:** ~30 seconds
- **Cost:** ~$0.01
- **Output:** `scripts/data-pipeline/output/embeddings-sample.jsonl`

**For production (full dataset):**

```bash
npm run data:embed-full
```

- **Time:** ~10-15 minutes
- **Cost:** ~$1.00
- **Output:** `scripts/data-pipeline/output/embeddings-full.jsonl`

**Model:** `all-MiniLM-L6-v2` (384 dimensions)
**GPU:** NVIDIA A10G (50x faster than CPU)

### Step 5: Import to SQLite

**For sample:**

```bash
npm run data:import -- --sample
```

**For full dataset:**

```bash
npm run data:import
```

This will:
- Import all embeddings into the database
- Calculate popularity scores from Tranco rankings
- Store metadata about the import

**Database size:**
- Sample (1K): ~2 MB
- Full (1M): ~2 GB

### Step 6: Validate

Check data integrity:

```bash
npm run data:validate
```

Tests:
- ✓ All tables exist
- ✓ No NULL embeddings
- ✓ Correct embedding dimensions (384)
- ✓ No NaN or Infinity values
- ✓ Popularity scores assigned
- ✓ Success rate statistics

### Step 7: Test k-NN Search

Test semantic similarity search:

```bash
npm run data:test-knn
```

This will:
- Query several well-known websites (nytimes.com, github.com, etc.)
- Show their 10 most similar websites
- Demonstrate semantic clustering

**Expected output:**
```
Query: nytimes.com
Top 10 similar websites:
  1. washingtonpost.com    94.2% - The Washington Post
  2. theguardian.com        92.8% - The Guardian
  3. bbc.com                91.5% - BBC News
  ...
```

## Quick Start (Sample Dataset)

Test the entire pipeline with 1,000 websites:

```bash
# One-time Modal setup
pip install modal
modal token new

# Run the pipeline
npm run data:init-db
npm run data:download-tranco
npm run data:scrape-sample
npm run data:embed-sample
npm run data:import -- --sample
npm run data:validate
npm run data:test-knn
```

**Total time:** ~3-5 minutes
**Total cost:** ~$0.03

## Full Production Pipeline

For the complete 1M website dataset:

```bash
npm run data:init-db
npm run data:download-tranco
npm run data:scrape-full      # ~15 min, $0.60
npm run data:embed-full       # ~15 min, $1.00
npm run data:import
npm run data:validate
npm run data:test-knn
```

**Total time:** ~30 minutes
**Total cost:** ~$1.60

## Output Files

All outputs are in `scripts/data-pipeline/output/`:

```
output/
├── tranco-top-1m.csv          # Downloaded rankings
├── metadata-sample.jsonl      # Scraped metadata (sample)
├── metadata-full.jsonl        # Scraped metadata (full)
├── embeddings-sample.jsonl    # Embeddings (sample)
├── embeddings-full.jsonl      # Embeddings (full)
└── neighborhood.db            # Final SQLite database (2 GB for full)
```

## Database Schema

```sql
CREATE TABLE websites (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  popularity_score REAL,           -- 0-100 based on Tranco rank
  embedding BLOB,                  -- 384 floats × 4 bytes = 1536 bytes
  embedding_dim INTEGER,           -- 384
  embedding_model TEXT,            -- 'all-MiniLM-L6-v2'
  scraped_at TIMESTAMP
);
```

## Usage in Chunk Generation

The database is ready to use for k-NN queries during chunk generation:

```typescript
import Database from 'better-sqlite3';

const db = new Database('scripts/data-pipeline/output/neighborhood.db');

// Find similar websites for chunk generation
function findSimilarWebsites(anchorUrl: string, k: number): string[] {
  // 1. Get anchor embedding
  const anchor = db.prepare('SELECT embedding FROM websites WHERE url = ?').get(anchorUrl);
  const anchorEmbedding = deserializeEmbedding(anchor.embedding);

  // 2. Calculate cosine similarity with all websites
  const allSites = db.prepare('SELECT url, embedding FROM websites').all();

  const similarities = allSites.map(site => ({
    url: site.url,
    similarity: cosineSimilarity(anchorEmbedding, deserializeEmbedding(site.embedding))
  }));

  // 3. Return top k
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .map(s => s.url);
}
```

## Troubleshooting

### Modal login issues

```bash
# Make sure you have a Modal account
modal token new

# Verify you're logged in
modal token current
```

### Out of memory during import

If importing 1M embeddings fails due to memory, reduce batch size in `import-to-sqlite.ts`:

```typescript
const batchSize = 500;  // Reduce from 1000
```

### Scraping failures

85-90% success rate is expected. Many websites:
- No longer exist
- Block automated requests
- Have paywalls
- Timeout

This is normal and expected.

### GPU costs

A10G GPU costs ~$0.60/hour. Embedding 1M websites takes ~15 minutes = ~$0.15.

If costs are a concern:
- Use CPU locally (free, but takes 83 hours)
- Start with sample dataset (1K websites)

## Cost Breakdown

| Task | Time | Cost |
|------|------|------|
| Scraping 1M URLs | 15 min | $0.60 |
| Embeddings (GPU) | 15 min | $1.00 |
| **Total** | **30 min** | **$1.60** |

**Your Modal credit:** $30 → Enough for 18 full runs!

## Next Steps

Once you have the database:

1. **Update generation logic** to use real k-NN instead of mock hash
2. **Test chunk generation** with semantic similarity
3. **Deploy to D1** when ready for production (Cloudflare)

See `IMPLEMENTATION.md` for next phases!
