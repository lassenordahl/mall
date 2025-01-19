import pandas as pd
import plotly.graph_objects as go
import pickle
from sklearn.decomposition import PCA
import numpy as np
from sentence_transformers import SentenceTransformer

def load_data():
    # Load clustered data
    df = pd.read_csv('clustered_websites.csv')

    # Load embeddings
    with open('embeddings.pkl', 'rb') as f:
        embeddings = pickle.load(f)

    return df, embeddings

def create_interactive_plot(df, embeddings):
    # Reduce dimensions for visualization
    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(embeddings)

    # Create figure
    fig = go.Figure()

    # Add scatter points for each cluster
    for cluster in df['cluster'].unique():
        mask = df['cluster'] == cluster
        cluster_data = df[mask]
        cluster_coords = coords[mask]

        fig.add_trace(go.Scatter(
            x=cluster_coords[:, 0],
            y=cluster_coords[:, 1],
            mode='markers+text',
            name=f'Cluster {cluster}',
            text=cluster_data['domain'],
            textposition="top center",
            hovertemplate=(
                "<b>Domain:</b> %{text}<br>"
                "<b>Description:</b> %{customdata[0]}<br>"
                "<extra></extra>"
            ),
            customdata=cluster_data[['description']].values,
            marker=dict(size=10, opacity=0.6)
        ))

    # Update layout
    fig.update_layout(
        title='Interactive Website Clusters',
        xaxis_title='PCA Component 1',
        yaxis_title='PCA Component 2',
        hovermode='closest',
        width=1200,
        height=800,
        showlegend=True,
        legend=dict(
            yanchor="top",
            y=0.99,
            xanchor="left",
            x=1.05
        )
    )

    return fig

def main():
    df, embeddings = load_data()
    fig = create_interactive_plot(df, embeddings)

    # Save interactive HTML
    fig.write_html("interactive_clusters.html")

    # Open in browser
    fig.show()

if __name__ == "__main__":
    main()
