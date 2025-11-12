#!/usr/bin/env tsx
/**
 * Export local database to SQL file for production import
 * This generates a SQL dump file that can be imported to production D1 via wrangler
 */

import Database from 'better-sqlite3';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_DB = join(__dirname, 'output', 'neighborhood.db');
const OUTPUT_FILE = join(__dirname, 'output', 'production-export.sql');

async function exportData() {
  console.log('📦 Exporting local database to production SQL file...\n');

  if (!existsSync(SOURCE_DB)) {
    console.error(`❌ Source database not found: ${SOURCE_DB}`);
    console.error('Run: npm run data:import -- --sample');
    process.exit(1);
  }

  const db = new Database(SOURCE_DB, { readonly: true });

  // Get all websites with embeddings
  const websites = db.prepare(`
    SELECT
      url,
      category as title,
      semantic_description as description,
      embedding,
      embedding_dim,
      popularity_score,
      generated_at as scraped_at
    FROM websites
  `).all();

  console.log(`Found ${websites.length} websites in local database`);
  console.log('Generating SQL statements...\n');

  // Helper to escape SQL strings
  const escapeString = (str: string | null) => {
    if (!str) return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
  };

  // Generate INSERT statements
  const insertStatements = websites.map((site: any, index: number) => {
    // Convert embedding to hex string for BLOB
    const embeddingHex = site.embedding ? Buffer.from(site.embedding).toString('hex') : null;

    // Progress indicator
    if ((index + 1) % 50 === 0) {
      console.log(`  Generated ${index + 1}/${websites.length} statements...`);
    }

    return `INSERT INTO websites (url, title, description, embedding, embedding_dim, popularity_score, scraped_at)
VALUES (
  ${escapeString(site.url)},
  ${escapeString(site.title)},
  ${escapeString(site.description)},
  ${embeddingHex ? `X'${embeddingHex}'` : 'NULL'},
  ${site.embedding_dim || 384},
  ${site.popularity_score || 0},
  '${site.scraped_at || new Date().toISOString()}'
);`;
  }).join('\n');

  const exportSQL = `-- Production Database Export
-- Generated: ${new Date().toISOString()}
-- Total websites: ${websites.length}

-- Import websites data
BEGIN TRANSACTION;

${insertStatements}

COMMIT;

-- Verify import
SELECT COUNT(*) as total_websites FROM websites;
`;

  // Write to file
  writeFileSync(OUTPUT_FILE, exportSQL, 'utf-8');

  db.close();

  const fileSizeMB = (Buffer.byteLength(exportSQL, 'utf-8') / 1024 / 1024).toFixed(2);

  console.log('\n========================================');
  console.log('✅ Export Complete!');
  console.log('========================================');
  console.log(`Exported: ${websites.length} websites`);
  console.log(`File: ${OUTPUT_FILE}`);
  console.log(`Size: ${fileSizeMB} MB`);
  console.log('\n📋 Next Steps:');
  console.log('1. Deploy your backend: cd packages/server && npm run deploy');
  console.log('2. Import to production D1:');
  console.log('   cd packages/server');
  console.log(`   wrangler d1 execute neighborhood-db --remote --file=../../scripts/data-pipeline/output/production-export.sql`);
  console.log('\n⏱️  Import will take 2-3 minutes for 548 websites.');
  console.log('========================================\n');
}

exportData().catch(console.error);
