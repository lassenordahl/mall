import sqlite3
import pandas as pd
from bs4 import BeautifulSoup
import time
import ollama
from pydantic import BaseModel
import requests
from typing import Optional, List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
from tqdm import tqdm

SITE_LIMIT = 1000
MAX_WORKERS = 10
BATCH_SIZE = 5

def setup_database():
    conn = sqlite3.connect('websites.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS websites
        (rank INTEGER PRIMARY KEY,
         domain TEXT,
         meta TEXT,
         description TEXT)
    ''')
    conn.commit()
    return conn

class WebsiteDescription(BaseModel):
    n: Optional[str]
    d: str

class WebsiteBatcher:
    def __init__(self):
        self.session = requests.Session()
        self.conn = setup_database()
        self.cursor = self.conn.cursor()

    async def process_domain_batch(self, domains: List[Dict]):
        meta_futures = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            meta_futures = [
                executor.submit(self.get_meta_tags, domain['domain'])
                for domain in domains
            ]

        descriptions = await asyncio.gather(*[
            self.get_llm_description(domain['domain'])
            for domain in domains
        ])

        for domain, meta_future, description in zip(domains, meta_futures, descriptions):
            result = {
                'rank': domain['rank'],
                'domain': domain['domain'],
                'meta': meta_future.result(),
                'description': description
            }
            self.save_record(result)

    def save_record(self, result):
        try:
            self.cursor.execute(
                'INSERT OR REPLACE INTO websites (rank, domain, meta, description) VALUES (?, ?, ?, ?)',
                (result['rank'], result['domain'], result['meta'], result['description'])
            )
            self.conn.commit()
            print(f"Saved record for {result['domain']}")
        except sqlite3.Error as e:
            print(f"Database error for {result['domain']}: {e}")
            self.conn.rollback()

    def get_meta_tags(self, url):
        try:
            response = self.session.get(
                f'https://{url}',
                timeout=10,
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            soup = BeautifulSoup(response.text, 'html.parser')
            meta = soup.find('meta', attrs={'name': 'description'})
            return meta.get('content') if meta else None
        except:
            return None

    async def get_llm_description(self, domain):
        try:
            response = ollama.chat(
                model='llama3.2',
                messages=[{
                    'role': 'user',
                    'content': f'In exactly 200 characters, describe what {domain} does as a website. Include the company name if known.'
                }]
            )
            return response.message.content.strip()
        except Exception as e:
            print(f"LLM error for {domain}: {str(e)}")
            return None

    def save_batch(self, results):
        cursor = self.conn.cursor()
        cursor.executemany(
            'INSERT OR REPLACE INTO websites (rank, domain, meta, description) VALUES (?, ?, ?, ?)',
            [(r['rank'], r['domain'], r['meta'], r['description']) for r in results]
        )
        self.conn.commit()

async def main():
    batcher = WebsiteBatcher()
    df = pd.read_csv('data/traco.csv', names=['rank', 'domain'])
    df = df.head(SITE_LIMIT)

    domains = df.to_dict('records')
    batches = [domains[i:i + BATCH_SIZE] for i in range(0, len(domains), BATCH_SIZE)]

    with tqdm(total=len(domains)) as pbar:
        for batch in batches:
            await batcher.process_domain_batch(batch)
            pbar.update(len(batch))

    batcher.conn.close()

if __name__ == "__main__":
    asyncio.run(main())
