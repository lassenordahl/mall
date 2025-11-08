/**
 * Download Tranco Top 1M list
 * Tranco is a research-grade website ranking combining multiple sources
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tranco-top-1m.csv');

// Tranco list URL (latest daily list)
const TRANCO_URL = 'https://tranco-list.eu/top-1m.csv.zip';

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect without location'));
          return;
        }

        // Follow redirect
        https.get(redirectUrl, (redirectResponse) => {
          redirectResponse.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', (err) => {
          fs.unlinkSync(dest);
          reject(err);
        });
      } else {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadTranco() {
  console.log('Downloading Tranco Top 1M list...');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Tranco provides daily lists - we need to get the latest list ID first
    // For now, we'll use a known stable list or create a mock for testing
    console.log('Using latest Tranco list...');

    // Try the latest list endpoint
    const csvUrl = 'https://tranco-list.eu/top-1m.csv';
    console.log(`URL: ${csvUrl}`);

    console.log('Downloading CSV file...');
    await downloadFile(csvUrl, OUTPUT_FILE);

    // Verify file
    const stats = fs.statSync(OUTPUT_FILE);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`\nDownload complete!`);
    console.log(`  File: ${OUTPUT_FILE}`);
    console.log(`  Size: ${fileSizeMB} MB`);

    // Read first few lines to verify format
    const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    const lines = content.split('\n').slice(0, 5);

    console.log(`\nFirst 5 entries:`);
    lines.forEach(line => console.log(`  ${line}`));

    console.log(`\nReady for scraping!`);
    console.log(`Next step: npm run data:scrape-sample`);

  } catch (error) {
    console.error('Error downloading Tranco list:', error);
    process.exit(1);
  }
}

downloadTranco();
