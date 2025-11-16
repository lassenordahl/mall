#!/bin/bash
# Reset local D1 database and import fresh data

echo "🗑️  Resetting local database..."
rm -rf .wrangler/state/v3/d1

echo "📋 Initializing schema..."
wrangler d1 execute neighborhood-db --local --file=./schema.sql

echo ""
echo "✅ Database reset complete!"
echo ""
echo "📦 Next steps:"
echo "  1. Import production data:    npm run db:pull-production"
echo "  2. Import test data:          npm run db:seed-test"
echo ""
