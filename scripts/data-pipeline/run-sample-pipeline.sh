#!/bin/bash

# Quick start script to run the entire sample pipeline
# This processes 1,000 websites to test the system

set -e  # Exit on error

echo "========================================="
echo "3D Neighborhood - Sample Data Pipeline"
echo "========================================="
echo ""
echo "This will:"
echo "  1. Initialize SQLite database"
echo "  2. Download Tranco Top 1M list"
echo "  3. Scrape 1,000 websites (Modal)"
echo "  4. Generate embeddings (Modal GPU)"
echo "  5. Import to database"
echo "  6. Validate data"
echo "  7. Test k-NN search"
echo ""
echo "Total time: ~3-5 minutes"
echo "Total cost: ~$0.03 (Modal)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Step 1: Initialize database
echo "Step 1/7: Initializing database..."
npm run data:init-db
echo ""

# Step 2: Download Tranco list
echo "Step 2/7: Downloading Tranco list..."
npm run data:download-tranco
echo ""

# Step 3: Scrape sample
echo "Step 3/7: Scraping 1,000 websites with Modal..."
echo "(This requires Modal authentication - you'll be prompted if not logged in)"
npm run data:scrape-sample
echo ""

# Step 4: Generate embeddings
echo "Step 4/7: Generating embeddings with Modal GPU..."
npm run data:embed-sample
echo ""

# Step 5: Import to SQLite
echo "Step 5/7: Importing to SQLite..."
npm run data:import -- --sample
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
echo "✓ Sample Pipeline Complete!"
echo "========================================="
echo ""
echo "Database ready at:"
echo "  scripts/data-pipeline/output/neighborhood.db"
echo ""
echo "To process the full 1M websites, run:"
echo "  ./scripts/data-pipeline/run-full-pipeline.sh"
echo ""
