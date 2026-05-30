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

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    goal TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    total_steps INTEGER NOT NULL,
    checkpoints TEXT,
    rollback TEXT,
    status TEXT DEFAULT 'running',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    summary TEXT,
    artifacts TEXT,
    issues TEXT,
    progress REAL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS task_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    step INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
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


async def save_task(task_id: str, goal: str, steps_json: str, total_steps: int, checkpoints: str = None, rollback: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            '''INSERT OR REPLACE INTO tasks (id, goal, steps_json, total_steps, checkpoints, rollback, status)
               VALUES (?, ?, ?, ?, ?, ?, 'running')''',
            (task_id, goal, steps_json, total_steps, checkpoints, rollback)
        )
        await db.commit()


async def update_task_step(task_id: str, step: int, state_json: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            'INSERT INTO task_snapshots (task_id, step, state_json) VALUES (?, ?, ?)',
            (task_id, step, state_json)
        )
        await db.commit()


async def update_task_progress(task_id: str, progress: float, status: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        if status:
            await db.execute(
                'UPDATE tasks SET progress = ?, status = ? WHERE id = ?',
                (progress, status, task_id)
            )
        else:
            await db.execute(
                'UPDATE tasks SET progress = ? WHERE id = ?',
                (progress, task_id)
            )
        await db.commit()


async def complete_task(task_id: str, status: str, summary: str = None, artifacts: str = None, issues: str = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            '''UPDATE tasks SET status = ?, summary = ?, artifacts = ?, issues = ?,
               finished_at = CURRENT_TIMESTAMP WHERE id = ?''',
            (status, summary, artifacts, issues, task_id)
        )
        await db.commit()


async def get_task(task_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        row = await db.execute_fetchall(
            'SELECT * FROM tasks WHERE id = ?', (task_id,)
        )
        if not row:
            return None
        r = row[0]
        return {
            'id': r[0], 'goal': r[1], 'steps_json': r[2], 'total_steps': r[3],
            'checkpoints': r[4], 'rollback': r[5], 'status': r[6],
            'started_at': r[7], 'finished_at': r[8], 'summary': r[9],
            'artifacts': r[10], 'issues': r[11], 'progress': r[12],
        }


async def get_active_task():
    async with aiosqlite.connect(DB_PATH) as db:
        row = await db.execute_fetchall(
            "SELECT * FROM tasks WHERE status = 'running' ORDER BY started_at DESC LIMIT 1"
        )
        if not row:
            return None
        r = row[0]
        return {
            'id': r[0], 'goal': r[1], 'steps_json': r[2], 'total_steps': r[3],
            'checkpoints': r[4], 'rollback': r[5], 'status': r[6],
            'started_at': r[7], 'finished_at': r[8], 'summary': r[9],
            'artifacts': r[10], 'issues': r[11], 'progress': r[12],
        }


async def get_task_history(limit: int = 10):
    async with aiosqlite.connect(DB_PATH) as db:
        rows = await db.execute_fetchall(
            '''SELECT id, goal, status, started_at, finished_at, summary, progress
               FROM tasks ORDER BY started_at DESC LIMIT ?''',
            (limit,)
        )
        return [{
            'id': r[0], 'goal': r[1], 'status': r[2],
            'started_at': r[3], 'finished_at': r[4], 'summary': r[5], 'progress': r[6]
        } for r in rows]
