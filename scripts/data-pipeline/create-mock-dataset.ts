/**
 * Create a mock dataset of popular websites for testing
 * This allows us to test the pipeline without needing the Tranco list
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tranco-top-1m.csv');

// Top ~1000 popular websites across various categories
const POPULAR_WEBSITES = [
  // Search & Tech Giants
  'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
  'linkedin.com', 'reddit.com', 'wikipedia.org', 'amazon.com', 'yahoo.com',
  'zoom.us', 'microsoft.com', 'apple.com', 'netflix.com', 'office.com',

  // News & Media
  'nytimes.com', 'washingtonpost.com', 'theguardian.com', 'bbc.com', 'cnn.com',
  'forbes.com', 'bloomberg.com', 'reuters.com', 'wsj.com', 'npr.org',
  'usatoday.com', 'latimes.com', 'telegraph.co.uk', 'time.com', 'politico.com',

  // Developer & Tech
  'github.com', 'stackoverflow.com', 'medium.com', 'gitlab.com', 'bitbucket.org',
  'dev.to', 'hackernews.com', 'techcrunch.com', 'wired.com', 'theverge.com',
  'arstechnica.com', 'slashdot.org', 'cloudflare.com', 'vercel.com', 'netlify.com',

  // E-commerce
  'ebay.com', 'etsy.com', 'walmart.com', 'target.com', 'bestbuy.com',
  'alibaba.com', 'shopify.com', 'wayfair.com', 'homedepot.com', 'ikea.com',

  // Social & Entertainment
  'tiktok.com', 'pinterest.com', 'snapchat.com', 'twitch.tv', 'discord.com',
  'spotify.com', 'soundcloud.com', 'vimeo.com', 'dailymotion.com', 'imgur.com',

  // Education & Reference
  'khanacademy.org', 'coursera.org', 'udemy.com', 'edx.org', 'mit.edu',
  'stanford.edu', 'harvard.edu', 'berkeley.edu', 'cornell.edu', 'yale.edu',

  // Finance
  'paypal.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'coinbase.com',
  'robinhood.com', 'schwab.com', 'vanguard.com', 'fidelity.com', 'etrade.com',

  // Travel & Local
  'booking.com', 'airbnb.com', 'expedia.com', 'tripadvisor.com', 'uber.com',
  'lyft.com', 'yelp.com', 'opentable.com', 'zillow.com', 'realtor.com',

  // Health & Wellness
  'webmd.com', 'healthline.com', 'mayoclinic.org', 'nih.gov', 'cdc.gov',
  'who.int', 'fitbit.com', 'myfitnesspal.com', 'peloton.com', 'calm.com',

  // Government & Organizations
  'gov.uk', 'usa.gov', 'europa.eu', 'un.org', 'nasa.gov',
  'weather.gov', 'usps.com', 'irs.gov', 'sec.gov', 'ftc.gov',
];

// Add more generic domains to reach 1000
const ADDITIONAL_DOMAINS = [
  // Popular country TLDs
  ...generateDomains('news', 100),
  ...generateDomains('shop', 100),
  ...generateDomains('blog', 100),
  ...generateDomains('tech', 100),
  ...generateDomains('app', 100),
  ...generateDomains('media', 100),
  ...generateDomains('info', 100),
  ...generateDomains('online', 100),
  ...generateDomains('web', 100),
  ...generateDomains('site', 100),
];

function generateDomains(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}.com`);
}

function createMockDataset() {
  console.log('Creating mock dataset for testing...');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Combine and ensure uniqueness
  const allWebsites = [...new Set([...POPULAR_WEBSITES, ...ADDITIONAL_DOMAINS])];

  // Pad to 1000 if needed
  while (allWebsites.length < 1000) {
    allWebsites.push(`site${allWebsites.length + 1}.com`);
  }

  // Create CSV in Tranco format: rank,domain
  const csvLines = allWebsites.map((domain, index) => `${index + 1},${domain}`);
  const csvContent = csvLines.join('\n');

  // Write to file
  fs.writeFileSync(OUTPUT_FILE, csvContent);

  console.log(`\nMock dataset created!`);
  console.log(`  File: ${OUTPUT_FILE}`);
  console.log(`  Total websites: ${allWebsites.length}`);
  console.log(`  Format: rank,domain (Tranco-compatible)`);

  // Show first 10 entries
  console.log(`\nFirst 10 entries:`);
  csvLines.slice(0, 10).forEach(line => console.log(`  ${line}`));

  console.log(`\nReady for scraping!`);
  console.log(`Next step: npm run data:scrape-sample`);
}

createMockDataset();
