import logging
import os
from pathlib import Path

logger = logging.getLogger('vertha-memory')

# Memory search is optional: chromadb and sentence-transformers are large packages. Without
# them the voice server still starts and everything else works; only memory search is off.
try:
    import chromadb
    from sentence_transformers import SentenceTransformer
    _MEMORY_IMPORT_ERROR = None
except ImportError as _exc:
    chromadb = None
    SentenceTransformer = None
    _MEMORY_IMPORT_ERROR = _exc


def _require_memory_packages():
    if chromadb is None or SentenceTransformer is None:
        raise RuntimeError(
            f'Memory search is off: {_MEMORY_IMPORT_ERROR}. Install chromadb and sentence-transformers '
            '(see requirements.txt) to turn it on.'
        )

MEMORY_PATH = Path.home() / '.local' / 'share' / 'vertha' / 'memory'
CHROMA_PATH = MEMORY_PATH / 'chroma'
EMBEDDING_MODEL = os.getenv('VERTHA_EMBEDDING_MODEL', 'all-MiniLM-L6-v2')

_client = None
_model = None


def get_chroma_client():
    global _client
    _require_memory_packages()
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    return _client


def get_model():
    global _model
    _require_memory_packages()
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
