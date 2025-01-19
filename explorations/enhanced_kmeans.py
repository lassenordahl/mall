import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
import hdbscan
import plotly.graph_objects as go
from sklearn.preprocessing import StandardScaler
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import umap
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('punkt_tab')

class EnhancedClusterer:
    def __init__(self):
        # Use larger BERT model for better embeddings
        self.model = SentenceTransformer('all-mpnet-base-v2')
        self.umap_reducer = umap.UMAP(
            n_neighbors=15,
            n_components=5,
            metric='cosine'
        )
        self.clusterer = hdbscan.HDBSCAN(
            min_cluster_size=5,
            min_samples=3,
            cluster_selection_epsilon=0.3,
            metric='euclidean',
            prediction_data=True
        )

    def preprocess_text(self, text):
        # Enhance description with domain-specific info
        tokens = word_tokenize(text.lower())
        stop_words = set(stopwords.words('english'))
        tokens = [t for t in tokens if t not in stop_words]
        return " ".join(tokens)

    def enhance_description(self, row):
        # Combine description with domain info
        domain_parts = row['domain'].split('.')
        return f"{row['description']} This website is a {domain_parts[-1]} domain."

    def get_embeddings(self, df):
        enhanced_descriptions = df.apply(self.enhance_description, axis=1)
        processed_texts = enhanced_descriptions.apply(self.preprocess_text)
        return self.model.encode(processed_texts.tolist())

    def cluster(self, embeddings):
        # Reduce dimensions while preserving relationships
        umap_embeddings = self.umap_reducer.fit_transform(embeddings)
        clusters = self.clusterer.fit_predict(umap_embeddings)
        return clusters, umap_embeddings

    def visualize(self, df, embeddings, clusters):
        fig = go.Figure()

        # Plot each cluster
        unique_clusters = np.unique(clusters)
        for cluster in unique_clusters:
            mask = clusters == cluster
            cluster_name = 'Noise' if cluster == -1 else f'Cluster {cluster}'

            fig.add_trace(go.Scatter(
                x=embeddings[mask, 0],
                y=embeddings[mask, 1],
                mode='markers+text',
                name=cluster_name,
                text=df[mask]['domain'],
                textposition="top center",
                hovertemplate=(
                    "<b>Domain:</b> %{text}<br>"
                    "<b>Description:</b> %{customdata[0]}<br>"
                    "<b>Cluster Probability:</b> %{customdata[1]:.2f}<br>"
                    "<extra></extra>"
                ),
                customdata=np.column_stack((
                    df[mask]['description'],
                    self.clusterer.probabilities_[mask]
                )),
                marker=dict(
                    size=10,
                    opacity=0.7,
                    sizemode='area',
                    sizeref=2.*max(self.clusterer.probabilities_)/(40.**2),
                    sizemin=4
                )
            ))

        fig.update_layout(
            title='Enhanced Website Clusters',
            xaxis_title='UMAP Component 1',
            yaxis_title='UMAP Component 2',
            hovermode='closest',
            width=1200,
            height=800
        )

        return fig

def main():
    df = pd.read_csv('clustered_websites.csv')
    clusterer = EnhancedClusterer()

    # Get enhanced embeddings
    embeddings = clusterer.get_embeddings(df)

    # Cluster data
    clusters, umap_embeddings = clusterer.cluster(embeddings)

    # Visualize results
    fig = clusterer.visualize(df, umap_embeddings, clusters)
    fig.write_html("enhanced_clusters.html")
    fig.show()

if __name__ == "__main__":
    main()
