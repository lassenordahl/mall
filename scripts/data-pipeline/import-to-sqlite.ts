/**
 * Import embeddings from JSONL into SQLite database
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'output', 'neighborhood.db');

interface EmbeddingData {
  url: string;
  title: string;
  description: string;
  embedding: string;  // Hex-encoded binary
  embedding_dim: number;
  embedding_model: string;
  timestamp: string;
}

function deserializeEmbedding(hexString: string): Buffer {
  // Convert hex string back to binary
  return Buffer.from(hexString, 'hex');
}

function calculatePopularityScore(rank: number, totalUrls: number): number {
  // Convert rank to score (higher rank = lower score)
  // Logarithmic scale: rank 1 → 100, rank 1M → 0
  return 100 - (Math.log10(rank) / Math.log10(totalUrls)) * 100;
}

async function importEmbeddings(inputFile: string, isSample: boolean = false) {
  console.log(`Importing embeddings from ${inputFile}...`);

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: ${inputFile} not found!`);
    console.log('\nPlease run the embedding generation first:');
    console.log(isSample ? '  npm run data:embed-sample' : '  npm run data:embed-full');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    console.log('Please run: npm run data:init-db');
    process.exit(1);
  }

  // Open database
  const db = new Database(DB_PATH);

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO websites
    (url, title, description, popularity_score, embedding, embedding_dim, embedding_model, scraped_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Begin transaction for performance
  const insertMany = db.transaction((items: EmbeddingData[]) => {
    for (const item of items) {
      insertStmt.run(
        item.url,
        item.title,
        item.description,
        0,  // Will be updated with rank-based score
        deserializeEmbedding(item.embedding),
        item.embedding_dim,
        item.embedding_model,
        item.timestamp
      );
    }
  });

  // Read and parse JSONL
  console.log('Reading embeddings...');
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.trim().split('\n');
  const items: EmbeddingData[] = lines.map(line => JSON.parse(line));

  console.log(`Found ${items.length} embeddings`);

  // Import in batches of 1000 for progress tracking
  const batchSize = 1000;
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  console.log('Importing into database...');
  for (let i = 0; i < batches.length; i++) {
    insertMany(batches[i]);
    if ((i + 1) % 10 === 0) {
      console.log(`  Imported ${Math.min((i + 1) * batchSize, items.length)}/${items.length} items...`);
    }
  }

  // Update popularity scores based on Tranco rank
  console.log('\nUpdating popularity scores from Tranco rankings...');
  const trancoFile = path.join(__dirname, 'output', 'tranco-top-1m.csv');

  if (fs.existsSync(trancoFile)) {
    const trancoContent = fs.readFileSync(trancoFile, 'utf-8');
    const trancoLines = trancoContent.trim().split('\n');

    const updateScoreStmt = db.prepare('UPDATE websites SET popularity_score = ? WHERE url = ?');
    const updateScores = db.transaction((rankings: Array<{rank: number, url: string}>) => {
      for (const { rank, url } of rankings) {
        const score = calculatePopularityScore(rank, trancoLines.length);
        updateScoreStmt.run(score, url);
      }
    });

    const rankings = trancoLines.map((line, index) => {
      const [rankStr, url] = line.split(',');
      return { rank: parseInt(rankStr), url };
    });

    updateScores(rankings);
    console.log('Popularity scores updated!');
  } else {
    console.log('Tranco file not found, skipping popularity scores');
  }

  // Insert metadata
  console.log('\nInserting metadata...');
  const metadataFile = inputFile.replace('embeddings', 'metadata');
  let totalUrls = 0;
  let successful = items.length;
  let failed = 0;

  if (fs.existsSync(metadataFile)) {
    const metaContent = fs.readFileSync(metadataFile, 'utf-8');
    const metaLines = metaContent.trim().split('\n');
    totalUrls = metaLines.length;
    failed = totalUrls - successful;
  }

  db.prepare(`
    INSERT INTO scrape_metadata
    (total_urls, successful_scrapes, failed_scrapes, embedding_model, embedding_dimensions)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    totalUrls || successful,
    successful,
    failed,
    'all-MiniLM-L6-v2',
    384
  );

  // Print statistics
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_websites,
      AVG(popularity_score) as avg_popularity,
      MAX(popularity_score) as max_popularity,
      MIN(popularity_score) as min_popularity
    FROM websites
  `).get() as any;

  console.log('\n========================================');
  console.log('Import Complete!');
  console.log('========================================');
  console.log(`Total websites: ${stats.total_websites}`);
  console.log(`Average popularity: ${stats.avg_popularity?.toFixed(2) || 0}`);
  console.log(`Popularity range: ${stats.min_popularity?.toFixed(2) || 0} - ${stats.max_popularity?.toFixed(2) || 0}`);
  console.log(`Database: ${DB_PATH}`);
  console.log('========================================');
  console.log('\nNext steps:');
  console.log('  1. npm run data:validate - Validate data');
  console.log('  2. npm run data:test-knn - Test k-NN queries');

  db.close();
}

// Determine which file to import
const args = process.argv.slice(2);
const isSample = args.includes('--sample');
const inputFile = isSample
  ? path.join(__dirname, 'output', 'embeddings-sample.jsonl')
  : path.join(__dirname, 'output', 'embeddings-full.jsonl');

importEmbeddings(inputFile, isSample);
