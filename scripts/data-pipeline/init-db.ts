/**
 * Initialize SQLite database with schema
 * Matches D1 schema from spec (Section 4.1)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'output', 'neighborhood.db');

// Schema with structured semantic profiles
const SCHEMA = `
-- Website metadata with structured semantic profiles
CREATE TABLE IF NOT EXISTS websites (
  url TEXT PRIMARY KEY,

  -- Structured semantic data (from LLM)
  category TEXT,
  subcategories TEXT,           -- JSON array stored as text
  purpose TEXT,
  audience TEXT,
  content_types TEXT,           -- JSON array stored as text
  primary_topics TEXT,          -- JSON array stored as text
  tone TEXT,

  -- Standardized description (generated from structure, used for embedding)
  semantic_description TEXT,

  -- Embedding
  embedding BLOB,               -- Binary: 384 floats × 4 bytes = 1536 bytes
  embedding_dim INTEGER DEFAULT 384,
  embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',

  -- Metadata
  data_source TEXT DEFAULT 'llm',  -- 'llm', 'scraped', 'hybrid'
  confidence TEXT DEFAULT 'high',  -- 'high', 'medium', 'low', 'unknown'
  popularity_score REAL DEFAULT 0,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_popularity ON websites(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_category ON websites(category);
CREATE INDEX IF NOT EXISTS idx_confidence ON websites(confidence);

-- Metadata about the data collection
CREATE TABLE IF NOT EXISTS scrape_metadata (
  id INTEGER PRIMARY KEY,
  total_urls INTEGER,
  successful_scrapes INTEGER,
  failed_scrapes INTEGER,
  embedding_model TEXT,
  embedding_dimensions INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- World configuration (for later use)
CREATE TABLE IF NOT EXISTS world_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function initDatabase() {
  console.log('Initializing SQLite database...');
  console.log(`Database path: ${DB_PATH}`);

  // Create output directory if needed
  const outputDir = path.dirname(DB_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Delete existing database if it exists (fresh start)
  if (fs.existsSync(DB_PATH)) {
    console.log('Removing existing database...');
    fs.unlinkSync(DB_PATH);
  }

  // Create database
  const db = new Database(DB_PATH);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  console.log('Creating tables...');

  // Execute schema
  db.exec(SCHEMA);

  // Insert default world config
  const insertConfig = db.prepare('INSERT OR REPLACE INTO world_config (key, value) VALUES (?, ?)');

  insertConfig.run('world_seed', '42');
  insertConfig.run('world_version', '1');
  insertConfig.run('embedding_model', 'all-MiniLM-L6-v2');
  insertConfig.run('embedding_dimensions', '384');

  console.log('Inserting default world config...');

  // Verify tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

  console.log('\nTables created:');
  tables.forEach((table: any) => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
    console.log(`  - ${table.name} (${count.count} rows)`);
  });

  db.close();

  console.log('\nDatabase initialized successfully!');
  console.log('Ready to import data.');
  console.log('\nNext steps:');
  console.log('  1. npm run data:scrape-sample');
  console.log('  2. npm run data:embed-sample');
  console.log('  3. npm run data:import');
}

initDatabase();
