#!/usr/bin/env tsx
/**
 * Push local database to production
 * Exports local D1 → generates SQL → imports to production D1
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

async function pushToProduction() {
  console.log('📤 Pushing local database to production...\n');

  // Get local data
  console.log('📋 Exporting local data...');
  const localDataJson = execSync(
    'wrangler d1 execute neighborhood-db --local --command="SELECT * FROM websites" --json',
    { encoding: 'utf-8' }
  );

  const localData = JSON.parse(localDataJson);
  const websites = localData[0].results;

  if (websites.length === 0) {
    console.error('❌ No data in local database to push!');
    process.exit(1);
  }

  console.log(`Found ${websites.length} websites locally\n`);

  // Generate SQL
  console.log('🔧 Generating SQL...');
  const escapeString = (str: string | null) => {
    if (!str) return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
  };

  const insertStatements = websites.map((site: any) => {
    const embeddingHex = site.embedding ? Buffer.from(site.embedding).toString('hex') : null;

    return `INSERT OR REPLACE INTO websites (url, title, description, embedding, embedding_dim, popularity_score, scraped_at)
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

  const sql = `-- Push to production
-- Generated: ${new Date().toISOString()}

BEGIN TRANSACTION;
${insertStatements}
COMMIT;
`;

  const tmpFile = '.wrangler/push-to-production.sql';
  writeFileSync(tmpFile, sql);

  // Push to production
  console.log('⬆️  Pushing to production D1...\n');
  execSync(`wrangler d1 execute neighborhood-db --remote --file=${tmpFile}`, {
    stdio: 'inherit'
  });

  console.log(`\n✅ Successfully pushed ${websites.length} websites to production!`);
}

pushToProduction().catch(console.error);
