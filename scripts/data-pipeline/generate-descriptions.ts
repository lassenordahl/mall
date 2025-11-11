/**
 * Generate standardized descriptions from structured semantic profiles
 * These standardized descriptions are used for embedding generation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SemanticProfile {
  domain: string;
  category: string;
  subcategories?: string[];
  purpose?: string;
  audience?: string;
  content_types?: string[];
  primary_topics?: string[];
  tone?: string;
  data_source: string;
  confidence: string;
  generated_at: string;
}

interface ProfileWithDescription extends SemanticProfile {
  semantic_description: string;
}

function generateStandardizedDescription(profile: SemanticProfile): string {
  // Handle unknown/error cases
  if (profile.category === 'Unknown' || profile.category === 'Error') {
    return `${profile.domain} is a website with unknown categorization.`;
  }

  // Build standardized description from structured data
  const parts: string[] = [];

  // Start with domain and category
  parts.push(`${profile.domain} is a ${profile.category} website`);

  // Add subcategories if present
  if (profile.subcategories && profile.subcategories.length > 0) {
    const subcatStr = profile.subcategories.join(', ');
    parts.push(`focused on ${subcatStr}`);
  }

  // Add purpose
  if (profile.purpose) {
    parts.push(`Its purpose is to ${profile.purpose.toLowerCase()}`);
  }

  // Add audience
  if (profile.audience) {
    parts.push(`It serves ${profile.audience.toLowerCase()}`);
  }

  // Add content types
  if (profile.content_types && profile.content_types.length > 0) {
    const contentStr = profile.content_types.join(', ');
    parts.push(`Primary content includes ${contentStr}`);
  }

  // Add topics
  if (profile.primary_topics && profile.primary_topics.length > 0) {
    const topicsStr = profile.primary_topics.join(', ');
    parts.push(`covering topics such as ${topicsStr}`);
  }

  // Add tone
  if (profile.tone) {
    parts.push(`The tone is ${profile.tone.toLowerCase()}`);
  }

  // Join all parts into coherent description
  let description = parts[0]; // Start with "domain is a category website"

  if (parts.length > 1) {
    // Add first connecting phrase with period
    description += ' ' + parts.slice(1, 2).join('. ');

    // Add remaining parts with periods
    if (parts.length > 2) {
      description += '. ' + parts.slice(2).join('. ');
    }
  }

  description += '.';

  return description;
}

async function generateDescriptions(inputFile: string, outputFile: string) {
  console.log(`Generating standardized descriptions from ${inputFile}...`);

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: ${inputFile} not found!`);
    console.log('Please run the LLM profiler first:');
    console.log('  npm run data:profile-sample');
    process.exit(1);
  }

  // Read profiles
  console.log('Reading profiles...');
  const content = fs.readFileSync(inputFile, 'utf-8');
  const lines = content.trim().split('\n');
  const profiles: SemanticProfile[] = lines.map(line => JSON.parse(line));

  console.log(`Loaded ${profiles.length} profiles`);

  // Generate descriptions
  console.log('Generating standardized descriptions...');
  const profilesWithDescriptions: ProfileWithDescription[] = profiles.map(profile => ({
    ...profile,
    semantic_description: generateStandardizedDescription(profile)
  }));

  // Write output
  console.log(`Writing to ${outputFile}...`);
  fs.writeFileSync(
    outputFile,
    profilesWithDescriptions.map(p => JSON.stringify(p)).join('\n')
  );

  // Show examples
  console.log('\nExample standardized descriptions:');
  console.log('─'.repeat(80));

  for (let i = 0; i < Math.min(5, profilesWithDescriptions.length); i++) {
    const profile = profilesWithDescriptions[i];
    console.log(`\n${profile.domain}:`);
    console.log(`  Category: ${profile.category}`);
    console.log(`  Description: ${profile.semantic_description}`);
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`\n✓ Generated ${profilesWithDescriptions.length} standardized descriptions`);
  console.log(`  Output: ${outputFile}`);
  console.log('\nNext step: npm run data:embed-sample');
}

// Determine input/output files
const args = process.argv.slice(2);
const isSample = args.includes('--sample');

const inputFile = isSample
  ? path.join(__dirname, 'output', 'profiles-sample.jsonl')
  : path.join(__dirname, 'output', 'profiles-full.jsonl');

const outputFile = isSample
  ? path.join(__dirname, 'output', 'profiles-with-descriptions-sample.jsonl')
  : path.join(__dirname, 'output', 'profiles-with-descriptions-full.jsonl');

generateDescriptions(inputFile, outputFile);
