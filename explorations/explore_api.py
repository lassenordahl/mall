from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import pickle
import sqlite3
import numpy as np
from sklearn.neighbors import NearestNeighbors
import random
import json

app = FastAPI()

# Load embeddings
with open('embeddings.pkl', 'rb') as f:
    embeddings = pickle.load(f)
embeddings = np.array(embeddings)

# Load domains
def load_domains():
    conn = sqlite3.connect('top_sites.db')
    cursor = conn.cursor()
    cursor.execute('SELECT domain FROM top_sites WHERE description IS NOT NULL')
    data = [row[0] for row in cursor.fetchall()]
    conn.close()
    return data

domains = load_domains()

# Build NearestNeighbors model
nn_model = NearestNeighbors(metric='cosine', algorithm='brute')
nn_model.fit(embeddings)

# Request models
class EmbeddingRequest(BaseModel):
    domains: List[str]
    top_n: int = 10

class CoordinatesRequest(BaseModel):
    x: int
    y: int
    source_x: int
    source_y: int

class CoordinatesResponse(BaseModel):
    domain: str

# Initialize the JSON map and in-memory store
coordinates_map = {}
assigned_domains = set()

# Load existing map from file if it exists
try:
    with open('coordinates_map.json', 'r') as f:
        coordinates_map = json.load(f)
        for domain in coordinates_map.values():
            assigned_domains.add(domain)
except FileNotFoundError:
    pass

@app.get('/random_embedding')
def get_random_embedding() -> Dict[str, str]:
    random_index = random.randint(0, len(domains) - 1)
    random_domain = domains[random_index]
    return {"domain": random_domain}

def _get_related_embeddings(input_domains: List[str], top_n: int) -> List[str]:
    # Map domain to index
    domain_to_index = {domain: idx for idx, domain in enumerate(domains)}

    indices = []
    for domain in input_domains:
        if domain in domain_to_index:
            indices.append(domain_to_index[domain])

    input_embeddings = embeddings[indices]
    _, neighbors = nn_model.kneighbors(input_embeddings, n_neighbors=top_n + len(input_domains) + len(assigned_domains))

    related_domains = []
    for i, domain in enumerate(input_domains):
        neighbor_indices = neighbors[i]

        for idx in neighbor_indices:
            neighbor_domain = domains[idx]

            if neighbor_domain not in input_domains and neighbor_domain not in related_domains and neighbor_domain not in assigned_domains:
                related_domains.append(neighbor_domain)
            if len(related_domains) >= top_n:
                break

    return related_domains

def generate_new_block(x: int, y: int, source_x: int, source_y: int) -> str:
    # Find the nearest existing block
    nearest_block_key = None
    min_distance = float('inf')
    for key in coordinates_map.keys():
        bx, by = map(int, key.split(','))
        distance = abs(bx - source_x) + abs(by - source_y)
        if distance < min_distance:
            min_distance = distance
            nearest_block_key = key

    if nearest_block_key is None:
        raise HTTPException(status_code=400, detail="No existing blocks to generate new embeddings from")

    nearest_domain = coordinates_map[nearest_block_key]

    # Get related embeddings for the nearest block
    related_domains = _get_related_embeddings([nearest_domain], top_n=5)

    # Select a unique domain
    available_domains = [domain for domain in related_domains if domain not in assigned_domains]
    if not available_domains:
        raise HTTPException(status_code=400, detail="Not enough available domains")

    selected_domain = random.choice(available_domains)
    coordinates_map[f"{x},{y}"] = selected_domain
    assigned_domains.add(selected_domain)

    # Save the updated map to file
    with open('coordinates_map.json', 'w') as f:
        json.dump(coordinates_map, f)

    return selected_domain

@app.post('/coordinates', response_model=CoordinatesResponse)
def get_coordinates(request: CoordinatesRequest) -> CoordinatesResponse:
    x, y = request.x, request.y
    source_x, source_y = request.source_x, request.source_y
    key = f"{x},{y}"

    if key in coordinates_map:
        return CoordinatesResponse(domain=coordinates_map[key])

    # Generate new block if coordinates do not exist
    new_domain = generate_new_block(x, y, source_x, source_y)
    return CoordinatesResponse(domain=new_domain)

@app.post('/seed')
def seed_initial_block() -> CoordinatesResponse:
    seed_domain = "google.com"
    if seed_domain not in domains:
        raise HTTPException(status_code=400, detail="Seed domain not found in the list of domains")

    # Generate the first block at coordinates (0, 0)
    key = "0,0"
    if key in coordinates_map:
        return CoordinatesResponse(domain=coordinates_map[key])

    # Get related embeddings for the seed domain
    related_domains = _get_related_embeddings([seed_domain], top_n=5)

    # Select a unique domain
    available_domains = [domain for domain in related_domains if domain not in assigned_domains]
    if not available_domains:
        raise HTTPException(status_code=400, detail="Not enough available domains")

    selected_domain = random.choice(available_domains)
    coordinates_map[key] = selected_domain
    assigned_domains.add(selected_domain)

    # Save the updated map to file
    with open('coordinates_map.json', 'w') as f:
        json.dump(coordinates_map, f)

    return CoordinatesResponse(domain=selected_domain)
