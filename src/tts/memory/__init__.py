from .db import (
    init_db,
    add_message,
    get_recent_messages,
    add_pinned,
    get_all_pinned,
    delete_pinned,
    create_session,
    update_session_summary,
    get_all_sessions,
)

# The embeddings module needs chromadb and sentence-transformers. Re-export it
# only when those are installed, so the SQLite store (db) imports without them.
try:
    from .embeddings import (
        generate_embedding,
        generate_embeddings_batch,
        add_to_collection,
        search_collection,
        delete_from_collection,
    )
except ImportError:  # ML packages not installed; db-only use still works
    pass
