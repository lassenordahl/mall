#!/usr/bin/env tsx
/**
 * Import data from the existing SQLite database (from data pipeline)
 * into the local D1 database for development.
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const SOURCE_DB = join(process.cwd(), '../../scripts/data-pipeline/output/neighborhood.db');
const WRANGLER_DB_PATH = join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

async function importData() {
  console.log('📦 Importing data from pipeline database to D1...\n');

  // Check source database exists
  if (!existsSync(SOURCE_DB)) {
    console.error(`❌ Source database not found: ${SOURCE_DB}`);
    console.error('Run: npm run data:import -- --sample');
    process.exit(1);
  }

  // Open source database
  const sourceDb = new Database(SOURCE_DB, { readonly: true });

  // Get website count
  const { count } = sourceDb.prepare('SELECT COUNT(*) as count FROM websites').get() as { count: number };
  console.log(`Found ${count} websites in source database`);

  // Get all websites with embeddings
  const websites = sourceDb.prepare(`
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

  sourceDb.close();

  console.log(`\n📝 Preparing to import ${websites.length} websites...\n`);

  // Create SQL file for import
  const insertStatements = websites.map((site: any) => {
    // Convert embedding to hex string for BLOB
    const embeddingHex = site.embedding ? Buffer.from(site.embedding).toString('hex') : null;

    // Safely escape strings with null checks
    const escapeString = (str: string | null) => {
      if (!str) return 'NULL';
      return `'${str.replace(/'/g, "''")}'`;
    };

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

  const importSQL = `
-- Import websites data
BEGIN TRANSACTION;
${insertStatements}
COMMIT;
`;

  // Write to temporary file
  const { writeFileSync } = await import('fs');
  const tmpFile = join(process.cwd(), '.wrangler', 'import-data.sql');
  writeFileSync(tmpFile, importSQL);

  console.log('⚡ Importing to D1 (this may take a moment)...');

  try {
    execSync(`wrangler d1 execute neighborhood-db --local --file=${tmpFile}`, {
      stdio: 'inherit'
    });
    console.log(`\n✅ Successfully imported ${websites.length} websites!`);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }

  // Cleanup
  try {
    const { unlinkSync } = await import('fs');
    unlinkSync(tmpFile);
  } catch (e) {
    // Ignore cleanup errors
  }

  console.log('\n✨ Database ready for local development!');
  console.log('Run: npm run dev');
}

importData().catch(console.error);
