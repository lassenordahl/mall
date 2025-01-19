import pickle
import random
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def load_embeddings(embeddings_file='embeddings.pkl'):
    with open(embeddings_file, 'rb') as f:
        embeddings = pickle.load(f)
    return embeddings

def load_domains(limit=1000):
    import sqlite3
    conn = sqlite3.connect('top_sites.db')
    cursor = conn.cursor()
    cursor.execute('SELECT domain FROM top_sites WHERE description IS NOT NULL LIMIT ?', (limit,))
    data = [row[0] for row in cursor.fetchall()]
    conn.close()
    return data

def find_related_embeddings(embeddings, indices, top_n=10):
    related_indices = []
    for idx in indices:
        embedding = embeddings[idx].reshape(1, -1)
        similarities = cosine_similarity(embedding, embeddings)[0]
        sim_indices = np.argsort(-similarities)[1:top_n+1]  # Exclude the embedding itself
        related_indices.append(sim_indices)
    return related_indices

def main():
    embeddings = load_embeddings()
    domains = load_domains(limit=len(embeddings))

    for _ in range(10):
        sample_indices = random.sample(range(len(embeddings)), 10)
        related = find_related_embeddings(np.array(embeddings), sample_indices, top_n=10)
        for idx_sample, sim_indices in zip(sample_indices, related):
            print(f"Domain: {domains[idx_sample]}")
            print("Related domains:")
            for idx in sim_indices:
                print(f"- {domains[idx]}")
            print("---")
        print("===")

if __name__ == '__main__':
    main()
