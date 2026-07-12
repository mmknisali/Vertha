import uuid
import logging
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import db, embeddings

logger = logging.getLogger('vertha-memory')

router = APIRouter(prefix='/memory', tags=['memory'])

MEMORY_PATH = Path.home() / '.local' / 'share' / 'vertha' / 'memory'
MEMORY_PATH.mkdir(parents=True, exist_ok=True)

MAX_CONTEXT_MEMORIES = int(os.getenv('VERTHA_MAX_CONTEXT_MEMORIES', '5'))
MEMORY_SIMILARITY_THRESHOLD = float(os.getenv('VERTHA_MEMORY_SIMILARITY_THRESHOLD', '0.35'))

current_session_id = str(uuid.uuid4())

AUTO_PIN_PATTERNS = [
    re.compile(r'remember that', re.IGNORECASE),
    re.compile(r"don't forget", re.IGNORECASE),
    re.compile(r'keep in mind', re.IGNORECASE),
    re.compile(r'always remember', re.IGNORECASE),
    re.compile(r'note that', re.IGNORECASE),
]


@asynccontextmanager
async def lifespan(app):
    await db.init_db()
    embeddings.get_model()
    await db.create_session(current_session_id)
    logger.info(f'Memory system initialized, session_id={current_session_id}')
    yield
    await db.update_session_summary(current_session_id, '[session ended]')
    logger.info('Memory session ended')


def detect_auto_pin(user_message: str) -> bool:
    for pattern in AUTO_PIN_PATTERNS:
        if pattern.search(user_message):
            return True
    return False


class SearchRequest(BaseModel):
    query: str
    limit: int = 5


class PinRequest(BaseModel):
    content: str
    source: str = None


class MessageRequest(BaseModel):
    role: str
    content: str
    session_id: str = None


@router.get('/health')
async def health():
    return {
        'status': 'ready',
        'session_id': current_session_id,
        'model': os.getenv('VERTHA_EMBEDDING_MODEL', 'all-MiniLM-L6-v2'),
    }


@router.post('/search')
async def search(req: SearchRequest):
    try:
        query_embedding = embeddings.generate_embedding(req.query)
        raw_results = embeddings.search_collection('conversations', query_embedding, limit=req.limit)
        pinned = await db.get_all_pinned()

        filtered_docs = []
        distances = raw_results.get('distances', [[]])[0]
        documents = raw_results.get('documents', [[]])[0]

        for doc, dist in zip(documents, distances):
            if dist < MEMORY_SIMILARITY_THRESHOLD:
                filtered_docs.append(doc)

        logger.info(f'Memory search: query="{req.query}" results={len(filtered_docs)}/{req.limit} (threshold={MEMORY_SIMILARITY_THRESHOLD})')
        return {
            'conversations': {'documents': [filtered_docs]},
            'pinned': pinned,
        }
    except Exception as e:
        logger.error(f'Search error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/pin')
async def pin(req: PinRequest):
    try:
        embedding = embeddings.generate_embedding(req.content)
        embedding_id = str(uuid.uuid4())
        embeddings.add_to_collection(
            'pinned',
            ids=[embedding_id],
            embeddings=[embedding],
            documents=[req.content],
            metadatas=[{'source': req.source or 'user'}]
        )
        pinned_id = await db.add_pinned(req.content, req.source, embedding_id)
        return {'id': pinned_id, 'content': req.content}
    except Exception as e:
        logger.error(f'Pin error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/pinned')
async def get_pinned():
    try:
        return await db.get_all_pinned()
    except Exception as e:
        logger.error(f'Get pinned error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/pinned/{id}')
async def delete_pinned(id: int):
    try:
        pinned = await db.get_all_pinned()
        target = next((p for p in pinned if p['id'] == id), None)
        if target and target.get('embedding_id'):
            embeddings.delete_from_collection('pinned', [target['embedding_id']])
        await db.delete_pinned(id)
        return {'status': 'deleted'}
    except Exception as e:
        logger.error(f'Delete pinned error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/clear')
async def clear_memory():
    try:
        await db.clear_all_memory()
        embeddings.clear_collection('conversations')
        embeddings.clear_collection('pinned')
        logger.info('All memory cleared')
        return {'status': 'cleared'}
    except Exception as e:
        logger.error(f'Clear memory error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/sessions')
async def get_sessions():
    try:
        return await db.get_all_sessions()
    except Exception as e:
        logger.error(f'Get sessions error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/session/summarize')
async def summarize_session():
    try:
        messages = await db.get_recent_messages(current_session_id, limit=50)
        if not messages:
            return {'summary': 'No messages in session'}
        # NOTE: Session summarization via Big Pickle is intentionally a placeholder.
        # Big Pickle integration would require a GROQ_API_KEY on the TTS server
        # and a call to /api/zen/v1/chat/completions. For now, sessions store
        # a placeholder summary. Implement summarization via Big Pickle when needed.
        summary = f"[ Session {current_session_id[:8]}... summary placeholder ]"
        await db.update_session_summary(current_session_id, summary)
        return {'summary': summary}
    except Exception as e:
        logger.error(f'Summarize error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/message')
async def add_message(req: MessageRequest):
    try:
        session_id = req.session_id or current_session_id
        content = req.content
        embedding = embeddings.generate_embedding(content)
        embedding_id = str(uuid.uuid4())
        embeddings.add_to_collection(
            'conversations',
            ids=[embedding_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[{'role': req.role, 'session_id': session_id}]
        )
        await db.add_message(session_id, req.role, content, embedding_id)

        if req.role == 'user' and detect_auto_pin(content):
            pin_embedding_id = str(uuid.uuid4())
            embeddings.add_to_collection(
                'pinned',
                ids=[pin_embedding_id],
                embeddings=[embedding],
                documents=[content],
                metadatas=[{'source': 'auto-pin'}]
            )
            await db.add_pinned(content, 'auto-pin', pin_embedding_id)
            logger.info(f'Auto-pinned: {content[:50]}...')

        return {'status': 'saved', 'embedding_id': embedding_id}
    except Exception as e:
        logger.error(f'Add message error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/context')
async def get_context():
    try:
        pinned = await db.get_all_pinned()
        return {'context': pinned}
    except Exception as e:
        logger.error(f'Get context error: {e}')
        raise HTTPException(status_code=500, detail=str(e))


def set_session_id(sid: str):
    global current_session_id
    current_session_id = sid


def get_session_id() -> str:
    return current_session_id
