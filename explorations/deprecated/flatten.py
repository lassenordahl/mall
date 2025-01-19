import sqlite3
import logging
import pickle
import numpy as np
import matplotlib.pyplot as plt
from sklearn.preprocessing import MinMaxScaler
from sklearn.decomposition import PCA

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def fetch_data(limit=1000):
    conn = sqlite3.connect('top_sites.db')
    cursor = conn.cursor()
    cursor.execute('SELECT domain, description FROM top_sites WHERE description IS NOT NULL LIMIT ?', (limit,))
    data = cursor.fetchall()
    conn.close()
    return data

def load_embeddings(embeddings_file='embeddings.pkl'):
    with open(embeddings_file, 'rb') as f:
        embeddings = pickle.load(f)
    return embeddings

def normalize_embeddings(embeddings):
    scaler = MinMaxScaler()
    normalized_embeddings = scaler.fit_transform(embeddings)
    return normalized_embeddings

def reduce_dimensions(embeddings, n_components=2):
    pca = PCA(n_components=n_components)
    reduced_embeddings = pca.fit_transform(embeddings)
    return reduced_embeddings

def create_spiral_grid(domains, grid_size=100):
    grid = np.full((grid_size, grid_size), None, dtype=object)
    x, y = grid_size // 2, grid_size // 2
    dx, dy = 0, -1
    for i, domain in enumerate(domains):
        if (-grid_size // 2 < x <= grid_size // 2) and (-grid_size // 2 < y <= grid_size // 2):
            grid_x = x + grid_size // 2
            grid_y = y + grid_size // 2

            if grid_x < 0 or grid_x >= grid_size or grid_y < 0 or grid_y >= grid_size:
              continue

            if grid[grid_x, grid_y] is None:
                grid[grid_x, grid_y] = []
            grid[grid_x, grid_y].append(i)
        if x == y or (x < 0 and x == -y) or (x > 0 and x == 1 - y):
            dx, dy = -dy, dx
        x, y = x + dx, y + dy
    return grid

def plot_grid(grid, domains, grid_size=100):
    plt.figure(figsize=(10, 10))
    for x in range(grid_size):
        for y in range(grid_size):
            if grid[x, y] is not None:
                for i in grid[x, y]:
                    plt.text(x, y, domains[i], fontsize=8, ha='center', va='center')
    plt.xlim(-1, grid_size)
    plt.ylim(-1, grid_size)
    plt.gca().invert_yaxis()
    plt.title('Grid-based Map of Websites')
    plt.show()

def main():
    # Fetch data from the database
    logging.info("Fetching data from the database...")
    data = fetch_data()
    domains = [item[0] for item in data]
    logging.info(f"Fetched {len(data)} records")

    # Load embeddings
    logging.info("Loading embeddings...")
    embeddings = load_embeddings()

    # Normalize embeddings
    logging.info("Normalizing embeddings...")
    normalized_embeddings = normalize_embeddings(embeddings)

    # Reduce dimensions
    logging.info("Reducing dimensions...")
    reduced_embeddings = reduce_dimensions(normalized_embeddings)

    # Create grid
    logging.info("Creating grid...")
    grid_size = 100
    grid = create_spiral_grid(domains, grid_size)

    # Plot grid
    logging.info("Plotting grid...")
    plot_grid(grid, domains, grid_size)

if __name__ == '__main__':
    main()
