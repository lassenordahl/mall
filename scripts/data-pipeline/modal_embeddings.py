"""
Modal GPU-based embedding generator
Uses Sentence Transformers with all-MiniLM-L6-v2 model
"""

import modal
import json
import struct
from typing import List, Dict
from datetime import datetime

# Create Modal app
app = modal.App("embedding-generator")

# Define image with ML dependencies
image = modal.Image.debian_slim().pip_install(
    "sentence-transformers==2.7.0",
    "torch==2.3.0",
    "transformers==4.40.0"
)


@app.function(
    image=image,
    gpu="A10G",  # NVIDIA A10G - good price/performance
    timeout=3600,
    memory=16384  # 16 GB RAM
)
def generate_embeddings_batch(metadata_items: List[Dict]) -> List[Dict]:
    """
    Generate embeddings for a batch of website metadata
    Returns metadata with embeddings attached
    """
    from sentence_transformers import SentenceTransformer
    import torch

    print(f"Loading model... (GPU: {torch.cuda.is_available()})")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    if torch.cuda.is_available():
        model = model.to('cuda')
        print(f"Using GPU: {torch.cuda.get_device_name(0)}")
    else:
        print("WARNING: No GPU detected, using CPU")

    # Prepare texts for embedding
    texts = []
    for item in metadata_items:
        # Combine title and description for richer embedding
        text = f"{item['title']}. {item['description']}"
        texts.append(text)

    print(f"Generating embeddings for {len(texts)} items...")

    # Generate embeddings (GPU accelerated)
    embeddings = model.encode(
        texts,
        batch_size=256,  # A10G can handle large batches
        show_progress_bar=False,
        normalize_embeddings=True,  # For cosine similarity
        convert_to_numpy=True
    )

    print(f"Embeddings generated: shape={embeddings.shape}")

    # Attach embeddings to metadata
    results = []
    for item, embedding in zip(metadata_items, embeddings):
        # Serialize embedding to binary format (saves space)
        embedding_binary = serialize_embedding(embedding.tolist())

        results.append({
            'url': item['url'],
            'title': item['title'],
            'description': item['description'],
            'embedding': embedding_binary.hex(),  # Hex string for JSON transport
            'embedding_dim': len(embedding),
            'embedding_model': 'all-MiniLM-L6-v2',
            'timestamp': datetime.utcnow().isoformat()
        })

    return results


def serialize_embedding(embedding: List[float]) -> bytes:
    """Pack embedding as binary (4 bytes per float)"""
    return struct.pack(f'{len(embedding)}f', *embedding)


@app.local_entrypoint()
def embed_sample():
    """Generate embeddings for sample dataset"""
    import os

    input_file = "scripts/data-pipeline/output/metadata-sample.jsonl"
    output_file = "scripts/data-pipeline/output/embeddings-sample.jsonl"

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Run npm run data:scrape-sample first.")
        return

    print("Reading metadata from sample...")
    metadata_items = []
    with open(input_file, 'r') as f:
        for line in f:
            item = json.loads(line)
            # Only process successful scrapes
            if item['status'] == 'success':
                metadata_items.append(item)

    print(f"Loaded {len(metadata_items)} items")

    if not metadata_items:
        print("No successful scrapes found!")
        return

    # Process in batches of 1000 (fits in GPU memory)
    batch_size = 1000
    batches = [metadata_items[i:i+batch_size] for i in range(0, len(metadata_items), batch_size)]

    print(f"Generating embeddings with Modal GPU ({len(batches)} batches)...")

    all_results = []
    for i, batch_results in enumerate(generate_embeddings_batch.map(batches)):
        all_results.extend(batch_results)
        print(f"  Batch {i+1}/{len(batches)} complete")

    # Write results
    print(f"Writing embeddings to {output_file}...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        for result in all_results:
            f.write(json.dumps(result) + '\n')

    print(f"\nDone!")
    print(f"  Generated embeddings: {len(all_results)}")
    print(f"  Embedding dimension: 384")
    print(f"  Model: all-MiniLM-L6-v2")
    print(f"  Output: {output_file}")


@app.local_entrypoint()
def embed_full():
    """Generate embeddings for full dataset"""
    import os

    input_file = "scripts/data-pipeline/output/metadata-full.jsonl"
    output_file = "scripts/data-pipeline/output/embeddings-full.jsonl"

    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Run npm run data:scrape-full first.")
        return

    print("Reading metadata from full dataset...")
    metadata_items = []
    with open(input_file, 'r') as f:
        for line in f:
            item = json.loads(line)
            # Only process successful scrapes
            if item['status'] == 'success':
                metadata_items.append(item)

    print(f"Loaded {len(metadata_items)} items")

    if not metadata_items:
        print("No successful scrapes found!")
        return

    # Process in batches of 1000 (fits in GPU memory)
    batch_size = 1000
    batches = [metadata_items[i:i+batch_size] for i in range(0, len(metadata_items), batch_size)]

    print(f"Generating embeddings with Modal GPU ({len(batches)} batches)...")
    print("This will take ~10-15 minutes...")

    all_results = []
    for i, batch_results in enumerate(generate_embeddings_batch.map(batches)):
        all_results.extend(batch_results)
        if (i + 1) % 10 == 0:
            print(f"  Processed {len(all_results)}/{len(metadata_items)} items...")

    # Write results
    print(f"Writing embeddings to {output_file}...")
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        for result in all_results:
            f.write(json.dumps(result) + '\n')

    print(f"\nDone!")
    print(f"  Generated embeddings: {len(all_results)}")
    print(f"  Embedding dimension: 384")
    print(f"  Model: all-MiniLM-L6-v2")
    print(f"  Output: {output_file}")
