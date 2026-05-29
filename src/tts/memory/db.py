import aiosqlite
import logging
from pathlib import Path

logger = logging.getLogger('vertha-memory')

MEMORY_PATH = Path.home() / '.local' / 'share' / 'vertha' / 'memory'
DB_PATH = MEMORY_PATH / 'vertha.db'

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    summary TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    embedding_id TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS pinned_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    embedding_id TEXT
);
"""


async def init_db():
    MEMORY_PATH.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()
    logger.info(f'Database initialized at {DB_PATH}')


async def add_message(session_id: str, role: str, content: str, embedding_id: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            'INSERT INTO conversations (session_id, role, content, embedding_id) VALUES (?, ?, ?, ?)',
            (session_id, role, content, embedding_id)
        )
        await db.commit()


async def get_recent_messages(session_id: str, limit: int = 10):
    async with aiosqlite.connect(DB_PATH) as db:
        rows = await db.execute_fetchall(
            'SELECT id, role, content FROM conversations WHERE session_id = ? ORDER BY id DESC LIMIT ?',
            (session_id, limit)
        )
        return [{'id': r[0], 'role': r[1], 'content': r[2]} for r in reversed(rows)]


async def add_pinned(content: str, source: str = None, embedding_id: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            'INSERT INTO pinned_memories (content, source, embedding_id) VALUES (?, ?, ?)',
            (content, source, embedding_id)
        )
        await db.commit()
        return cursor.lastrowid


async def get_all_pinned():
    async with aiosqlite.connect(DB_PATH) as db:
        rows = await db.execute_fetchall(
            'SELECT id, content, source, created_at, embedding_id FROM pinned_memories ORDER BY id'
        )
        return [{'id': r[0], 'content': r[1], 'source': r[2], 'created_at': r[3], 'embedding_id': r[4]} for r in rows]


async def delete_pinned(id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('DELETE FROM pinned_memories WHERE id = ?', (id,))
        await db.commit()


async def create_session(session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('INSERT OR IGNORE INTO sessions (id) VALUES (?)', (session_id,))
        await db.commit()


async def update_session_summary(session_id: str, summary: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute('UPDATE sessions SET summary = ? WHERE id = ?', (summary, session_id))
        await db.commit()


async def get_all_sessions():
    async with aiosqlite.connect(DB_PATH) as db:
        rows = await db.execute_fetchall(
            'SELECT id, started_at, summary FROM sessions ORDER BY started_at DESC'
        )
        return [{'id': r[0], 'started_at': r[1], 'summary': r[2]} for r in rows]
