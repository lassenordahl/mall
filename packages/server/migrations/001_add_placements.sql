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

-- Chunks table for caching generated chunks
CREATE TABLE IF NOT EXISTS chunks (
  chunk_x INTEGER NOT NULL,
  chunk_z INTEGER NOT NULL,
  data TEXT NOT NULL,
  world_version INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chunk_x, chunk_z)
);

CREATE INDEX IF NOT EXISTS idx_chunks_version ON chunks(world_version);
