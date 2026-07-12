import logging
import os
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

logger = logging.getLogger('vertha-memory')

MEMORY_PATH = Path.home() / '.local' / 'share' / 'vertha' / 'memory'
CHROMA_PATH = MEMORY_PATH / 'chroma'
EMBEDDING_MODEL = os.getenv('VERTHA_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')

_client = None
_model = None


def get_chroma_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return _client


def get_model():
    global _model
    if _model is None:
        logger.info(f'Loading embedding model: {EMBEDDING_MODEL}')
        _model = SentenceTransformer(EMBEDDING_MODEL, device='cpu')
        logger.info('Embedding model loaded')
    return _model


def generate_embedding(text: str):
    model = get_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def generate_embeddings_batch(texts: list[str]):
    model = get_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return [e.tolist() for e in embeddings]


def get_collection(name: str):
    client = get_chroma_client()
    return client.get_or_create_collection(name=name)


def add_to_collection(collection_name: str, ids: list[str], embeddings: list, documents: list, metadatas: list = None):
    collection = get_collection(collection_name)
    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )


def search_collection(collection_name: str, query_embedding: list, limit: int = 5):
    collection = get_collection(collection_name)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=limit
    )
    return results


def delete_from_collection(collection_name: str, ids: list[str]):
    collection = get_collection(collection_name)
    collection.delete(ids=ids)


def clear_collection(collection_name: str):
    client = get_chroma_client()
    try:
        client.delete_collection(name=collection_name)
    except Exception as e:
        logger.warning(f'Could not delete collection {collection_name}: {e}')
    client.get_or_create_collection(name=collection_name)
