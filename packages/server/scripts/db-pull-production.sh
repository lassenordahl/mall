#!/bin/bash
# Pull production data to local database

echo "📥 Pulling production data..."

# Export all websites from production
wrangler d1 execute neighborhood-db --remote --command="SELECT * FROM websites" --json > .wrangler/production-data.json

# Generate SQL insert statements
node -e "
const data = require('./.wrangler/production-data.json');
const websites = data[0].results;

console.log('-- Production data export');
console.log('BEGIN TRANSACTION;');

websites.forEach(site => {
  const escape = str => str ? \`'\${str.replace(/'/g, \"''\")}\'\` : 'NULL';
  const embeddingHex = site.embedding ? Buffer.from(site.embedding).toString('hex') : null;

  console.log(\`INSERT INTO websites (url, title, description, embedding, embedding_dim, popularity_score, scraped_at) VALUES (\${escape(site.url)}, \${escape(site.title)}, \${escape(site.description)}, \${embeddingHex ? \`X'\${embeddingHex}'\` : 'NULL'}, \${site.embedding_dim || 384}, \${site.popularity_score || 0}, '\${site.scraped_at || new Date().toISOString()}');\`);
});

console.log('COMMIT;');
" > .wrangler/production-import.sql

echo "📦 Importing to local database..."
wrangler d1 execute neighborhood-db --local --file=.wrangler/production-import.sql

echo ""
echo "✅ Imported $(wrangler d1 execute neighborhood-db --local --command='SELECT COUNT(*) FROM websites' --json | node -e "console.log(JSON.parse(require('fs').readFileSync(0))[0].results[0]['COUNT(*)'])") websites from production"
