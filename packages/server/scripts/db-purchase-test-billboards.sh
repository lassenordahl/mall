#!/bin/bash
# Purchase 5 random billboards with test images
# Run this AFTER visiting the site so chunks (and billboards) have been generated

echo "🎨 Purchasing 5 random billboards..."

npx wrangler d1 execute neighborhood-db --local --command="
UPDATE billboards
SET
  image_url = '/billboards/test.svg',
  purchased_at = datetime('now'),
  owner_user_id = 1
WHERE id IN (
  SELECT id FROM billboards ORDER BY RANDOM() LIMIT 5
);"

echo "✅ Purchased 5 billboards with test image"
echo "💡 Refresh your browser to see the billboards!"
