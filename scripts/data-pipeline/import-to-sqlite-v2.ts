/**
 * Import structured semantic profiles + embeddings into SQLite database
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'output', 'neighborhood.db');

interface EmbeddingData {
  domain: string;

  // Structured semantic data
  category?: string;
  subcategories?: string[];
  purpose?: string;
  audience?: string;
  content_types?: string[];
  primary_topics?: string[];
  tone?: string;
  semantic_description?: string;

  // Metadata
  data_source?: string;
  confidence?: string;

  // Embedding
  embedding: string;  // Hex-encoded binary
  embedding_dim: number;
  embedding_model: string;
  timestamp: string;
}

function deserializeEmbedding(hexString: string): Buffer {
  return Buffer.from(hexString, 'hex');
}

function calculatePopularityScore(rank: number, totalUrls: number): number {
  return 100 - (Math.log10(rank) / Math.log10(totalUrls)) * 100;
}

async function importEmbeddings(inputFile: string, isSample: boolean = false) {
  console.log(`Importing structured profiles from ${inputFile}...`);

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: ${inputFile} not found!`);
    console.log('\nPlease run the full pipeline first:');
    console.log(isSample ? '  npm run data:profile-sample' : '  npm run data:profile-full');
    console.log(isSample ? '  npm run data:generate-descriptions -- --sample' : '  npm run data:generate-descriptions');
    console.log(isSample ? '  npm run data:embed-sample' : '  npm run data:embed-full');
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    console.log('Please run: npm run data:init-db');
    process.exit(1);
  }

  const db = new Database(DB_PATH);

  // Prepare insert statement with new schema
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO websites
    (url, category, subcategories, purpose, audience, content_types, primary_topics, tone,
     semantic_description, embedding, embedding_dim, embedding_model, data_source, confidence,
     popularity_score, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: EmbeddingData[]) => {
    for (const item of items) {
      insertStmt.run(
        item.domain,
        item.category || null,
        item.subcategories ? JSON.stringify(item.subcategories) : null,
        item.purpose || null,
        item.audience || null,
        item.content_types ? JSON.stringify(item.content_types) : null,
        item.primary_topics ? JSON.stringify(item.primary_topics) : null,
        item.tone || null,
        item.semantic_description || null,
        deserializeEmbedding(item.embedding),
        item.embedding_dim,
        item.embedding_model,
        item.data_source || 'llm',
        item.confidence || 'high',
        0,  // Will be updated with rank-based score
        item.timestamp
      );
    }
  });

  console.log('Reading embeddings...');
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.trim().split('\n');
  const items: EmbeddingData[] = lines.map(line => JSON.parse(line));

  console.log(`Found ${items.length} embeddings`);

  // Import in batches
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

  // Update popularity scores
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
  }

  // Insert metadata
  console.log('\nInserting metadata...');
  db.prepare(`
    INSERT INTO scrape_metadata
    (total_urls, successful_scrapes, failed_scrapes, embedding_model, embedding_dimensions)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    items.length,
    items.length,
    0,
    'all-MiniLM-L6-v2',
    384
  );

  // Print statistics
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_websites,
      COUNT(DISTINCT category) as unique_categories,
      AVG(popularity_score) as avg_popularity,
      SUM(CASE WHEN confidence = 'high' THEN 1 ELSE 0 END) as high_confidence,
      SUM(CASE WHEN confidence = 'unknown' THEN 1 ELSE 0 END) as unknown_confidence
    FROM websites
  `).get() as any;

  // Top categories
  const topCategories = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM websites
    WHERE category IS NOT NULL AND category != 'Unknown'
    GROUP BY category
    ORDER BY count DESC
    LIMIT 10
  `).all() as any[];

  console.log('\n========================================');
  console.log('Import Complete!');
  console.log('========================================');
  console.log(`Total websites: ${stats.total_websites}`);
  console.log(`Unique categories: ${stats.unique_categories}`);
  console.log(`High confidence: ${stats.high_confidence} (${(100*stats.high_confidence/stats.total_websites).toFixed(1)}%)`);
  console.log(`Unknown: ${stats.unknown_confidence} (${(100*stats.unknown_confidence/stats.total_websites).toFixed(1)}%)`);
  console.log(`Average popularity: ${stats.avg_popularity?.toFixed(2) || 0}`);
  console.log(`Database: ${DB_PATH}`);

  console.log('\nTop 10 Categories:');
  topCategories.forEach((cat, i) => {
    console.log(`  ${i + 1}. ${cat.category}: ${cat.count} sites`);
  });

  console.log('\n========================================');
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
