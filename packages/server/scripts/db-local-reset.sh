#!/bin/bash
# Reset local D1 database to fresh schema state
# This nukes the database completely and applies a fresh schema.
# Use npm run db:import-local or npm run db:pull-production to add data.

echo "🗑️  Resetting local database..."
rm -rf .wrangler/state/v3/d1

echo "📋 Initializing fresh schema..."
wrangler d1 execute neighborhood-db --local --file=./schema.sql

echo ""
echo "✅ Database reset complete!"
echo ""
echo "📦 Next steps - choose one:"
echo "  1. Import full data pipeline:  npm run db:import-local"
echo "  2. Import production data:     npm run db:pull-production"
echo "  3. Seed test data:             npm run db:seed-test"
echo ""
