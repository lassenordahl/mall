/**
 * Validate the imported database
 * Check for data integrity, embedding quality, etc.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'output', 'neighborhood.db');

interface Website {
  url: string;
  title: string;
  description: string;
  popularity_score: number;
  embedding: Buffer;
  embedding_dim: number;
}

function deserializeEmbedding(blob: Buffer): number[] {
  const floatArray: number[] = [];
  for (let i = 0; i < blob.length; i += 4) {
    floatArray.push(blob.readFloatLE(i));
  }
  return floatArray;
}

function validateDatabase() {
  console.log('Validating database...');
  console.log(`Database: ${DB_PATH}\n`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    console.log('Please run: npm run data:init-db && npm run data:import');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  let errors = 0;
  let warnings = 0;

  // Test 1: Check table existence
  console.log('Test 1: Checking tables...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  const requiredTables = ['websites', 'scrape_metadata', 'world_config'];
  const existingTables = tables.map(t => t.name);

  for (const table of requiredTables) {
    if (existingTables.includes(table)) {
      console.log(`  ✓ ${table} exists`);
    } else {
      console.log(`  ✗ ${table} missing`);
      errors++;
    }
  }

  // Test 2: Check website count
  console.log('\nTest 2: Checking website count...');
  const websiteCount = db.prepare('SELECT COUNT(*) as count FROM websites').get() as { count: number };
  if (websiteCount.count > 0) {
    console.log(`  ✓ Found ${websiteCount.count} websites`);
  } else {
    console.log(`  ✗ No websites in database`);
    errors++;
  }

  // Test 3: Check for NULL embeddings
  console.log('\nTest 3: Checking embeddings...');
  const nullEmbeddings = db.prepare('SELECT COUNT(*) as count FROM websites WHERE embedding IS NULL').get() as { count: number };
  if (nullEmbeddings.count === 0) {
    console.log(`  ✓ All websites have embeddings`);
  } else {
    console.log(`  ⚠ ${nullEmbeddings.count} websites missing embeddings`);
    warnings++;
  }

  // Test 4: Check embedding dimensions
  console.log('\nTest 4: Validating embedding dimensions...');
  const websites = db.prepare('SELECT url, embedding, embedding_dim FROM websites LIMIT 10').all() as Website[];

  let dimensionErrors = 0;
  for (const site of websites) {
    const embedding = deserializeEmbedding(site.embedding);
    if (embedding.length !== site.embedding_dim) {
      console.log(`  ✗ ${site.url}: expected ${site.embedding_dim} dims, got ${embedding.length}`);
      dimensionErrors++;
    }
  }

  if (dimensionErrors === 0) {
    console.log(`  ✓ All embeddings have correct dimensions (384)`);
  } else {
    console.log(`  ✗ ${dimensionErrors} websites have incorrect embedding dimensions`);
    errors += dimensionErrors;
  }

  // Test 5: Check for NaN or Infinity in embeddings
  console.log('\nTest 5: Checking for invalid values in embeddings...');
  let invalidEmbeddings = 0;

  for (const site of websites) {
    const embedding = deserializeEmbedding(site.embedding);
    const hasInvalid = embedding.some(val => !isFinite(val));
    if (hasInvalid) {
      console.log(`  ✗ ${site.url}: contains NaN or Infinity`);
      invalidEmbeddings++;
    }
  }

  if (invalidEmbeddings === 0) {
    console.log(`  ✓ No invalid values found (checked ${websites.length} samples)`);
  } else {
    console.log(`  ✗ ${invalidEmbeddings} websites have invalid embedding values`);
    errors += invalidEmbeddings;
  }

  // Test 6: Check popularity scores
  console.log('\nTest 6: Checking popularity scores...');
  const popularityStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(popularity_score) as avg_score,
      MIN(popularity_score) as min_score,
      MAX(popularity_score) as max_score,
      SUM(CASE WHEN popularity_score = 0 THEN 1 ELSE 0 END) as zero_scores
    FROM websites
  `).get() as any;

  console.log(`  Total websites: ${popularityStats.total}`);
  console.log(`  Score range: ${popularityStats.min_score?.toFixed(2)} - ${popularityStats.max_score?.toFixed(2)}`);
  console.log(`  Average score: ${popularityStats.avg_score?.toFixed(2)}`);

  if (popularityStats.zero_scores > 0) {
    console.log(`  ⚠ ${popularityStats.zero_scores} websites have zero popularity score`);
    warnings++;
  } else {
    console.log(`  ✓ All websites have popularity scores`);
  }

  // Test 7: Sample some websites
  console.log('\nTest 7: Sampling websites...');
  const samples = db.prepare('SELECT url, title, popularity_score FROM websites ORDER BY popularity_score DESC LIMIT 5').all() as any[];

  console.log('  Top 5 by popularity:');
  samples.forEach((site, i) => {
    console.log(`    ${i + 1}. ${site.url} (${site.title}) - Score: ${site.popularity_score.toFixed(2)}`);
  });

  // Test 8: Check metadata
  console.log('\nTest 8: Checking scrape metadata...');
  const metadata = db.prepare('SELECT * FROM scrape_metadata ORDER BY created_at DESC LIMIT 1').get() as any;

  if (metadata) {
    console.log(`  ✓ Metadata found`);
    console.log(`    Total URLs: ${metadata.total_urls}`);
    console.log(`    Successful: ${metadata.successful_scrapes}`);
    console.log(`    Failed: ${metadata.failed_scrapes}`);
    console.log(`    Success rate: ${(100 * metadata.successful_scrapes / metadata.total_urls).toFixed(1)}%`);
    console.log(`    Embedding model: ${metadata.embedding_model}`);
  } else {
    console.log(`  ⚠ No metadata found`);
    warnings++;
  }

  db.close();

  // Summary
  console.log('\n========================================');
  console.log('Validation Summary');
  console.log('========================================');

  if (errors === 0 && warnings === 0) {
    console.log('✓ All tests passed!');
    console.log('\nDatabase is ready for use.');
    console.log('Next step: npm run data:test-knn');
  } else {
    if (errors > 0) {
      console.log(`✗ ${errors} error(s) found`);
    }
    if (warnings > 0) {
      console.log(`⚠ ${warnings} warning(s) found`);
    }

    if (errors > 0) {
      console.log('\nPlease fix errors before proceeding.');
      process.exit(1);
    } else {
      console.log('\nWarnings can be ignored, but check if they affect your use case.');
    }
  }
}

validateDatabase();
