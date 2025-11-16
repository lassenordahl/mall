-- 3D Neighborhood Database Schema
-- Cloudflare D1 (SQLite)

-- Websites table with embeddings
CREATE TABLE IF NOT EXISTS websites (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  embedding BLOB,              -- 384 floats stored as binary (Float32Array)
  embedding_dim INTEGER,       -- Should be 384
  popularity_score REAL,
  scraped_at TEXT              -- ISO timestamp
);

CREATE INDEX IF NOT EXISTS idx_websites_popularity ON websites(popularity_score DESC);

-- Placements table tracks where each website has been placed in the world
CREATE TABLE IF NOT EXISTS placements (
  url TEXT PRIMARY KEY,
  chunk_x INTEGER NOT NULL,
  chunk_z INTEGER NOT NULL,
  grid_x INTEGER NOT NULL,
  grid_z INTEGER NOT NULL,
  world_x REAL NOT NULL,
  world_z REAL NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_placements_chunk ON placements(chunk_x, chunk_z);
CREATE INDEX IF NOT EXISTS idx_placements_created ON placements(created_at);

-- Cached chunk data (JSON blobs)
CREATE TABLE IF NOT EXISTS chunks (
  chunk_x INTEGER NOT NULL,
  chunk_z INTEGER NOT NULL,
  data TEXT NOT NULL,          -- JSON string of ChunkData
  world_version INTEGER NOT NULL,
  generated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (chunk_x, chunk_z)
);

CREATE INDEX IF NOT EXISTS idx_chunks_version ON chunks(world_version);
CREATE INDEX IF NOT EXISTS idx_chunks_generated ON chunks(generated_at);
