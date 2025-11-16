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

-- Billboards table tracks ad placements on buildings
CREATE TABLE IF NOT EXISTS billboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_url TEXT NOT NULL,           -- FK to websites(url)
  face TEXT NOT NULL,                   -- 'north', 'south', 'east', 'west', 'top'
  position_x REAL NOT NULL,             -- Relative % (0.0-1.0) on face
  position_y REAL NOT NULL,             -- Relative % (0.0-1.0) on face
  width REAL NOT NULL,                  -- Billboard width in world units
  height REAL NOT NULL,                 -- Billboard height in world units
  image_url TEXT,                       -- Cloudflare Images URL (null = unclaimed)
  owner_user_id INTEGER,                -- FK to users(id) (null for now, future phase)
  purchased_at TEXT,                    -- ISO timestamp
  expires_at TEXT,                      -- NULL = forever, or ISO timestamp
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (building_url) REFERENCES websites(url)
);

CREATE INDEX IF NOT EXISTS idx_billboards_building ON billboards(building_url);
CREATE INDEX IF NOT EXISTS idx_billboards_owner ON billboards(owner_user_id);
