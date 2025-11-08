#!/bin/bash

# Full pipeline script to process all 1M websites
# WARNING: This will take ~30 minutes and cost ~$1.60 on Modal

set -e  # Exit on error

echo "========================================="
echo "3D Neighborhood - Full Data Pipeline"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will process 1,000,000 websites"
echo ""
echo "This will:"
echo "  1. Initialize SQLite database"
echo "  2. Download Tranco Top 1M list"
echo "  3. Scrape 1M websites (Modal)"
echo "  4. Generate embeddings (Modal GPU)"
echo "  5. Import to database (~2GB)"
echo "  6. Validate data"
echo "  7. Test k-NN search"
echo ""
echo "Total time: ~30 minutes"
echo "Total cost: ~$1.60 (Modal)"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""

# Step 1: Initialize database
echo "Step 1/7: Initializing database..."
npm run data:init-db
echo ""

# Step 2: Download Tranco list
echo "Step 2/7: Downloading Tranco list..."
npm run data:download-tranco
echo ""

# Step 3: Scrape full dataset
echo "Step 3/7: Scraping 1M websites with Modal..."
echo "(This will take ~10-15 minutes)"
npm run data:scrape-full
echo ""

# Step 4: Generate embeddings
echo "Step 4/7: Generating embeddings with Modal GPU..."
echo "(This will take ~10-15 minutes)"
npm run data:embed-full
echo ""

# Step 5: Import to SQLite
echo "Step 5/7: Importing to SQLite..."
echo "(This may take a few minutes for 1M records)"
npm run data:import
echo ""

# Step 6: Validate
echo "Step 6/7: Validating database..."
npm run data:validate
echo ""

# Step 7: Test k-NN
echo "Step 7/7: Testing k-NN search..."
npm run data:test-knn
echo ""

echo "========================================="
echo "✓ Full Pipeline Complete!"
echo "========================================="
echo ""
echo "Database ready at:"
echo "  scripts/data-pipeline/output/neighborhood.db"
echo "  Size: ~2 GB"
echo ""
echo "You can now use this database for chunk generation!"
echo "See IMPLEMENTATION.md for next steps."
echo ""
