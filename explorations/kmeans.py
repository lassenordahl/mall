import logging
import pickle
import os
from tqdm import tqdm
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score
from itertools import product

import sqlite3
import pandas as pd
from sklearn.preprocessing import normalize

logging.basicConfig(level=logging.INFO)

class WebsiteClusterer:
    def __init__(self, descriptions, domains):
        self.descriptions = descriptions
        self.domains = domains
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embeddings = None
        self.best_kmeans = None
        self.reduced_embeddings = None

    def get_embeddings(self):
        embeddings_file = 'embeddings.pkl'
        if os.path.exists(embeddings_file):
            logging.info("Loading cached embeddings...")
            with open(embeddings_file, 'rb') as f:
                self.embeddings = pickle.load(f)
        else:
            logging.info("Generating embeddings...")
            self.embeddings = []
            for description in tqdm(self.descriptions):
                self.embeddings.append(self.model.encode(description))
            with open(embeddings_file, 'wb') as f:
                pickle.dump(self.embeddings, f)

    def evaluate_parameters(self):
        param_grid = {
            'n_clusters': [3, 5, 7, 10],
            'init': ['k-means++', 'random'],
            'n_init': [10, 20, 30]
        }

        results = []
        params_combinations = [dict(zip(param_grid.keys(), v))
                             for v in product(*param_grid.values())]

        for params in tqdm(params_combinations, desc="Testing parameters"):
            kmeans = KMeans(**params, max_iter=500, random_state=42)
            clusters = kmeans.fit_predict(self.embeddings)

            result = {
                **params,
                'silhouette': silhouette_score(self.embeddings, clusters),
                'inertia': kmeans.inertia_,
                'davies_bouldin': davies_bouldin_score(self.embeddings, clusters)
            }
            results.append(result)

        return pd.DataFrame(results)

    def plot_evaluation_results(self, results_df):
        fig, axes = plt.subplots(1, 3, figsize=(20, 5))
        metrics = ['silhouette', 'inertia', 'davies_bouldin']
        titles = ['Silhouette Score', 'Inertia', 'Davies-Bouldin Index']

        for ax, metric, title in zip(axes, metrics, titles):
            for init in results_df['init'].unique():
                data = results_df[results_df['init'] == init]
                ax.plot(data['n_clusters'], data[metric],
                       marker='o', label=f'init={init}')
            ax.set_xlabel('Number of Clusters')
            ax.set_ylabel(title)
            ax.legend()

        plt.tight_layout()
        plt.savefig('parameter_evaluation.png')
        plt.close()

    def cluster_with_best_params(self, results_df):
        best_params = results_df.loc[results_df['silhouette'].idxmax()]
        logging.info(f"Best parameters: {best_params.to_dict()}")

        self.best_kmeans = KMeans(
            n_clusters=int(best_params['n_clusters']),
            init=best_params['init'],
            n_init=int(best_params['n_init']),
            max_iter=500,
            random_state=42
        )
        return self.best_kmeans.fit_predict(self.embeddings)

    def reduce_dimensions(self):
        pca = PCA(n_components=2, random_state=42)
        self.reduced_embeddings = pca.fit_transform(self.embeddings)
        return pca.transform(self.best_kmeans.cluster_centers_)

    def plot_clusters(self, clusters, centers_reduced):
        plt.figure(figsize=(15, 10))

        for i in range(self.best_kmeans.n_clusters):
            points = self.reduced_embeddings[clusters == i]
            plt.scatter(points[:, 0], points[:, 1],
                      label=f'Cluster {i}',
                      alpha=0.6,
                      s=100)

        plt.scatter(centers_reduced[:, 0], centers_reduced[:, 1],
                   c='black',
                   marker='x',
                   s=200,
                   linewidths=3,
                   label='Centroids')

        for i, domain in enumerate(self.domains):
            plt.annotate(domain,
                        (self.reduced_embeddings[i, 0],
                         self.reduced_embeddings[i, 1]),
                        xytext=(5, 5),
                        textcoords='offset points',
                        fontsize=8,
                        alpha=0.7)

        plt.title('Semantic Clustering of Websites')
        plt.xlabel('PCA Component 1')
        plt.ylabel('PCA Component 2')
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        plt.savefig('clusters.png')
        plt.close()

def main():
    # Load your descriptions and domains here
    descriptions = []  # Add your descriptions
    domains = []      # Add your domains

    clusterer = WebsiteClusterer(descriptions, domains)
    clusterer.get_embeddings()

    results = clusterer.evaluate_parameters()
    clusterer.plot_evaluation_results(results)

    clusters = clusterer.cluster_with_best_params(results)
    centers_reduced = clusterer.reduce_dimensions()
    clusterer.plot_clusters(clusters, centers_reduced)

def load_website_data():
    conn = sqlite3.connect('websites.db')
    df = pd.read_sql_query("""
        SELECT domain, description
        FROM websites
        WHERE description IS NOT NULL
    """, conn)
    conn.close()
    return df

def ahh():
    # Load data
    df = load_website_data()
    descriptions = df['description'].tolist()
    domains = df['domain'].tolist()

    # Initialize and run clusterer
    clusterer = WebsiteClusterer(descriptions, domains)
    clusterer.get_embeddings()

    # Evaluate parameters and plot results
    results = clusterer.evaluate_parameters()
    clusterer.plot_evaluation_results(results)

    # Generate final clusters and visualization
    clusters = clusterer.cluster_with_best_params(results)
    centers_reduced = clusterer.reduce_dimensions()
    clusterer.plot_clusters(clusters, centers_reduced)

    # Save cluster assignments
    df['cluster'] = clusters
    df.to_csv('clustered_websites.csv', index=False)

if __name__ == "__main__":
    ahh()
