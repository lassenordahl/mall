#!/bin/bash
# Seed local database with test data

echo "🌱 Seeding test data..."

cat > .wrangler/test-seed.sql << 'EOF'
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
EOF

wrangler d1 execute neighborhood-db --local --file=.wrangler/test-seed.sql

echo "✅ Seeded 15 test websites"
