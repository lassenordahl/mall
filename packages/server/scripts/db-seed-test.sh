#!/bin/bash
# Seed local database with 15 test websites + 5 test billboards
# Prerequisites: Run npm run db:reset first

echo "🌱 Seeding 15 test websites + 5 test billboards..."

cat > .wrangler/test-seed.sql << 'EOF'
-- Insert test websites
INSERT INTO websites (url, title, description, embedding_dim, popularity_score, scraped_at) VALUES
('google.com', 'Search Engine', 'Leading search engine and technology company', 384, 1000, '2024-01-01T00:00:00Z'),
('github.com', 'Developer Platform', 'Code hosting and collaboration platform', 384, 900, '2024-01-01T00:00:00Z'),
('stackoverflow.com', 'Developer Q&A', 'Question and answer site for programmers', 384, 800, '2024-01-01T00:00:00Z'),
('youtube.com', 'Video Platform', 'Video sharing and streaming service', 384, 950, '2024-01-01T00:00:00Z'),
('reddit.com', 'Social News', 'Social news aggregation and discussion website', 384, 850, '2024-01-01T00:00:00Z'),
('wikipedia.org', 'Encyclopedia', 'Free online encyclopedia', 384, 920, '2024-01-01T00:00:00Z'),
('amazon.com', 'E-commerce', 'Online retail marketplace', 384, 980, '2024-01-01T00:00:00Z'),
('netflix.com', 'Streaming', 'Video streaming service', 384, 870, '2024-01-01T00:00:00Z'),
('twitter.com', 'Social Media', 'Microblogging and social networking', 384, 890, '2024-01-01T00:00:00Z'),
('linkedin.com', 'Professional Network', 'Business and employment social network', 384, 860, '2024-01-01T00:00:00Z'),
('facebook.com', 'Social Network', 'Social networking service', 384, 970, '2024-01-01T00:00:00Z'),
('instagram.com', 'Photo Sharing', 'Photo and video sharing social network', 384, 880, '2024-01-01T00:00:00Z'),
('cloudflare.com', 'Web Infrastructure', 'Web infrastructure and security company', 384, 840, '2024-01-01T00:00:00Z'),
('vercel.com', 'Deployment Platform', 'Cloud platform for static sites and serverless functions', 384, 830, '2024-01-01T00:00:00Z'),
('openai.com', 'AI Research', 'Artificial intelligence research company', 384, 820, '2024-01-01T00:00:00Z');

-- Insert 5 test billboards (purchased fixtures)
-- Note: width/height are set to 0 here, will be calculated as 80% of building width at render time
-- The actual calculation happens in the Billboard component based on building dimensions
INSERT INTO billboards (building_url, face, position_x, position_y, width, height, image_url, owner_user_id, purchased_at) VALUES
('google.com', 'north', 0.5, 0.75, 0, 0, '/billboards/test.svg', 1, datetime('now')),
('github.com', 'east', 0.5, 0.75, 0, 0, '/billboards/test.svg', 1, datetime('now')),
('youtube.com', 'west', 0.5, 0.75, 0, 0, '/billboards/test.svg', 1, datetime('now')),
('reddit.com', 'south', 0.5, 0.75, 0, 0, '/billboards/test.svg', 1, datetime('now')),
('amazon.com', 'top', 0.5, 0.75, 0, 0, '/billboards/test.svg', 1, datetime('now'));
EOF

wrangler d1 execute neighborhood-db --local --file=.wrangler/test-seed.sql

echo "✅ Seeded 15 test websites + 5 test billboards"
echo "💡 Start the dev server and billboards will appear on buildings!"
