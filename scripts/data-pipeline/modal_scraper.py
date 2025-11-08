"""
Modal-based website metadata scraper
Scrapes title and description from websites in parallel
"""

import modal
import asyncio
import json
from datetime import datetime
from typing import List, Dict
import aiohttp
from bs4 import BeautifulSoup

# Create Modal app
app = modal.App("website-scraper")

# Define image with dependencies
image = modal.Image.debian_slim().pip_install(
    "aiohttp==3.9.1",
    "beautifulsoup4==4.12.2",
    "lxml==4.9.3"
)


@app.function(
    image=image,
    cpu=2,
    timeout=600,
    retries=2,
    concurrency_limit=50  # 50 parallel workers
)
async def scrape_batch(urls: List[str]) -> List[Dict]:
    """Scrape metadata from a batch of URLs"""
    results = []

    # Configure aiohttp with reasonable timeouts and limits
    timeout = aiohttp.ClientTimeout(total=10, connect=5)
    connector = aiohttp.TCPConnector(limit_per_host=10, limit=100)

    async with aiohttp.ClientSession(
        timeout=timeout,
        connector=connector,
        headers={
            'User-Agent': 'Mozilla/5.0 (compatible; 3DNeighborhoodBot/1.0; Research)'
        }
    ) as session:
        tasks = [scrape_single_url(session, url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    # Process results, handling exceptions
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            processed_results.append({
                'url': urls[i],
                'status': 'failed',
                'error': str(result),
                'timestamp': datetime.utcnow().isoformat()
            })
        else:
            processed_results.append(result)

    return processed_results


async def scrape_single_url(session: aiohttp.ClientSession, url: str) -> Dict:
    """Scrape a single URL and extract metadata"""
    try:
        # Try HTTPS first
        full_url = f"https://{url}" if not url.startswith('http') else url

        async with session.get(full_url, allow_redirects=True) as response:
            # Check status
            if response.status != 200:
                return {
                    'url': url,
                    'status': 'failed',
                    'error': f'HTTP {response.status}',
                    'timestamp': datetime.utcnow().isoformat()
                }

            # Read content
            html = await response.text()
            soup = BeautifulSoup(html, 'lxml')

            # Extract title
            title_tag = soup.find('title')
            title = title_tag.get_text().strip() if title_tag else url

            # Extract description (try multiple meta tags)
            description = None

            # Try standard meta description
            desc_tag = soup.find('meta', attrs={'name': 'description'})
            if desc_tag and desc_tag.get('content'):
                description = desc_tag.get('content').strip()

            # Try og:description
            if not description:
                og_desc = soup.find('meta', attrs={'property': 'og:description'})
                if og_desc and og_desc.get('content'):
                    description = og_desc.get('content').strip()

            # Try twitter:description
            if not description:
                tw_desc = soup.find('meta', attrs={'name': 'twitter:description'})
                if tw_desc and tw_desc.get('content'):
                    description = tw_desc.get('content').strip()

            # Fallback to first paragraph if no meta description
            if not description:
                first_p = soup.find('p')
                if first_p:
                    description = first_p.get_text().strip()[:500]

            # Ultimate fallback: use title
            if not description:
                description = title

            return {
                'url': url,
                'title': title[:500],  # Limit title length
                'description': description[:1000],  # Limit description length
                'status': 'success',
                'timestamp': datetime.utcnow().isoformat()
            }

    except asyncio.TimeoutError:
        return {
            'url': url,
            'status': 'failed',
            'error': 'Timeout',
            'timestamp': datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            'url': url,
            'status': 'failed',
            'error': f'{type(e).__name__}: {str(e)[:200]}',
            'timestamp': datetime.utcnow().isoformat()
        }


@app.local_entrypoint()
def scrape_sample():
    """Scrape a sample of 1000 URLs for testing"""
    import os

    # Read URLs from Tranco list
    input_file = "scripts/data-pipeline/output/tranco-top-1m.csv"
    output_file = "scripts/data-pipeline/output/metadata-sample.jsonl"

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Run npm run data:download-tranco first.")
        return

    print("Reading URLs from Tranco list...")
    with open(input_file, 'r') as f:
        urls = [line.strip().split(',')[1] for line in f.readlines()[:1000]]

    print(f"Scraping {len(urls)} URLs with Modal...")

    # Split into batches of 100
    batch_size = 100
    batches = [urls[i:i+batch_size] for i in range(0, len(urls), batch_size)]

    # Process batches in parallel
    all_results = []
    for results in scrape_batch.map(batches):
        all_results.extend(results)

    # Write results
    print(f"Writing results to {output_file}...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        for result in all_results:
            f.write(json.dumps(result) + '\n')

    # Print stats
    successful = sum(1 for r in all_results if r['status'] == 'success')
    failed = len(all_results) - successful
    print(f"\nResults:")
    print(f"  Successful: {successful}/{len(all_results)} ({100*successful/len(all_results):.1f}%)")
    print(f"  Failed: {failed}")
    print(f"  Output: {output_file}")


@app.local_entrypoint()
def scrape_full():
    """Scrape full 1M URLs"""
    import os

    input_file = "scripts/data-pipeline/output/tranco-top-1m.csv"
    output_file = "scripts/data-pipeline/output/metadata-full.jsonl"

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Run npm run data:download-tranco first.")
        return

    print("Reading URLs from Tranco list...")
    with open(input_file, 'r') as f:
        urls = [line.strip().split(',')[1] for line in f.readlines()]

    print(f"Scraping {len(urls)} URLs with Modal (this will take ~10-15 minutes)...")

    # Split into batches of 100
    batch_size = 100
    batches = [urls[i:i+batch_size] for i in range(0, len(urls), batch_size)]

    # Process batches in parallel
    all_results = []
    for i, results in enumerate(scrape_batch.map(batches)):
        all_results.extend(results)
        if (i + 1) % 100 == 0:
            print(f"  Processed {(i+1)*batch_size}/{len(urls)} URLs...")

    # Write results
    print(f"Writing results to {output_file}...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        for result in all_results:
            f.write(json.dumps(result) + '\n')

    # Print stats
    successful = sum(1 for r in all_results if r['status'] == 'success')
    failed = len(all_results) - successful
    print(f"\nResults:")
    print(f"  Successful: {successful}/{len(all_results)} ({100*successful/len(all_results):.1f}%)")
    print(f"  Failed: {failed}")
    print(f"  Output: {output_file}")
