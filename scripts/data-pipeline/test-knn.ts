/**
 * Test k-NN similarity search
 * Demonstrates semantic clustering of websites
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
}

function deserializeEmbedding(blob: Buffer): number[] {
  const floatArray: number[] = [];
  for (let i = 0; i < blob.length; i += 4) {
    floatArray.push(blob.readFloatLE(i));
  }
  return floatArray;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function findSimilar(db: Database.Database, queryUrl: string, k: number = 15): Array<{url: string, title: string, similarity: number}> {
  // Get query embedding
  const queryWebsite = db.prepare('SELECT embedding FROM websites WHERE url = ?').get(queryUrl) as Website | undefined;

  if (!queryWebsite) {
    console.log(`Website not found: ${queryUrl}`);
    return [];
  }

  const queryEmbedding = deserializeEmbedding(queryWebsite.embedding);

  // Get all websites
  const allWebsites = db.prepare('SELECT url, title, embedding FROM websites').all() as Website[];

  // Calculate similarities
  const similarities = allWebsites.map(site => ({
    url: site.url,
    title: site.title,
    similarity: cosineSimilarity(queryEmbedding, deserializeEmbedding(site.embedding))
  }));

  // Sort by similarity (descending) and return top k
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k + 1)  // +1 because query itself will be included
    .filter(s => s.url !== queryUrl);  // Remove query from results
}

function testKNN() {
  console.log('Testing k-NN Similarity Search');
  console.log('========================================\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    console.log('Please run the full pipeline first:');
    console.log('  1. npm run data:init-db');
    console.log('  2. npm run data:scrape-sample');
    console.log('  3. npm run data:embed-sample');
    console.log('  4. npm run data:import -- --sample');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  // Test cases: various well-known websites
  const testCases = [
    'nytimes.com',
    'github.com',
    'stackoverflow.com',
    'netflix.com',
    'wikipedia.org'
  ];

  for (const testUrl of testCases) {
    // Check if URL exists
    const exists = db.prepare('SELECT COUNT(*) as count FROM websites WHERE url = ?').get(testUrl) as { count: number };

    if (exists.count === 0) {
      console.log(`⚠ Skipping ${testUrl} (not in database)\n`);
      continue;
    }

    console.log(`Query: ${testUrl}`);
    console.log('─'.repeat(60));

    const similar = findSimilar(db, testUrl, 10);

    if (similar.length === 0) {
      console.log('  No results found');
    } else {
      console.log('Top 10 similar websites:');
      similar.forEach((site, i) => {
        const simPercent = (site.similarity * 100).toFixed(1);
        console.log(`  ${i + 1}. ${site.url.padEnd(30)} ${simPercent}% - ${site.title.substring(0, 40)}`);
      });
    }

    console.log('\n');
  }

  // Test semantic coherence
  console.log('========================================');
  console.log('Semantic Coherence Test');
  console.log('========================================\n');

  console.log('This test checks if similar websites cluster together.');
  console.log('Expected behavior:');
  console.log('  - News sites should be similar to other news sites');
  console.log('  - Tech sites should be similar to other tech sites');
  console.log('  - Shopping sites should be similar to other shopping sites\n');

  // Get some random websites and show their neighbors
  const randomSites = db.prepare('SELECT url, title FROM websites ORDER BY RANDOM() LIMIT 3').all() as { url: string, title: string }[];

  for (const site of randomSites) {
    console.log(`Random site: ${site.url} - ${site.title}`);
    console.log('Nearest neighbors:');

    const neighbors = findSimilar(db, site.url, 5);
    neighbors.forEach((neighbor, i) => {
      const simPercent = (neighbor.similarity * 100).toFixed(1);
      console.log(`  ${i + 1}. ${neighbor.url} (${simPercent}%)`);
    });

    console.log('');
  }

  db.close();

  console.log('========================================');
  console.log('k-NN Test Complete!');
  console.log('========================================\n');
  console.log('If you see semantically related websites clustering together,');
  console.log('the embeddings are working correctly!\n');
  console.log('This data is ready for use in chunk generation.');
}

testKNN();
