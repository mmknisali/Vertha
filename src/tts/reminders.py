"""Reminders on the same SQLite store as the rest of Vertha's memory.

Three doors onto one store: the tools layer (ToolExecutor, the same way
bash_exec and file_read are wired), the REST router under /reminders (what the
UI calls), and a background checker that surfaces reminders as they fall due.
"""
import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from memory import db as memory_db

logger = logging.getLogger('vertha-reminders')

router = APIRouter(prefix='/reminders', tags=['reminders'])

CHECK_INTERVAL_SECONDS = 15
STORAGE_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
_RELATIVE = re.compile(r'^\s*in\s+(\d+)\s*(second|minute|hour|day)s?\s*$', re.IGNORECASE)
_UNIT_SECONDS = {'second': 1, 'minute': 60, 'hour': 3600, 'day': 86400}


class ReminderError(ValueError):
    """A reminder request the user (or the model) got wrong; safe to show."""


def parse_due(value, now: datetime | None = None) -> datetime:
    """Read a due time and return it as an aware UTC datetime.

    Accepts "in 30 minutes" / "in 2 hours" / "in 1 day" (relative to now),
    or ISO 8601 ("2026-11-11T08:00", "2026-11-11T08:00:00+03:00"). A naive ISO
    time is read as the server's local time.
    """
    now = now or datetime.now(timezone.utc)
    if isinstance(value, datetime):
        dt = value
    else:
        text = (value or '').strip()
        if not text:
            raise ReminderError('A due time is needed, for example "in 30 minutes".')
        match = _RELATIVE.match(text)
        if match:
            amount = int(match.group(1))
            if amount <= 0:
                raise ReminderError('The due time has to be in the future.')
            return now + timedelta(seconds=amount * _UNIT_SECONDS[match.group(2).lower()])
        try:
            dt = datetime.fromisoformat(text.replace('Z', '+00:00'))
        except ValueError:
            raise ReminderError(f'I could not read the due time "{text}".')
    if dt.tzinfo is None:
        dt = dt.astimezone()  # naive: server local time
    return dt.astimezone(timezone.utc)


def to_storage(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime(STORAGE_FORMAT)


def from_storage(text: str) -> datetime:
    return datetime.strptime(text, STORAGE_FORMAT).replace(tzinfo=timezone.utc)


def _public(row: dict) -> dict:
    return {
        'id': row['id'],
        'text': row['text'],
        'due_at': row['due_at'],
        'done': row['done'],
        'notified': row['notified_at'] is not None,
    }


async def add(text, due, now: datetime | None = None) -> dict:
    clean = (text or '').strip()
    if not clean:
        raise ReminderError('The reminder needs some text.')
    due_dt = parse_due(due, now)
    stored = to_storage(due_dt)
    new_id = await memory_db.add_reminder(clean, stored)
    return {'id': new_id, 'text': clean, 'due_at': stored, 'done': False, 'notified': False}


async def list_open(include_done: bool = False) -> list[dict]:
    rows = await memory_db.list_reminders(include_done=include_done)
    return [_public(r) for r in rows]


async def mark_done(reminder_id, now: datetime | None = None) -> dict:
    try:
        rid = int(reminder_id)
    except (TypeError, ValueError):
        raise ReminderError('Give the reminder id as a number.')
    now = now or datetime.now(timezone.utc)
    if not await memory_db.complete_reminder(rid, to_storage(now)):
        existing = await memory_db.get_reminder(rid)
        if existing is None:
            raise LookupError(f'No reminder with id {rid}.')
        if existing['done']:
            raise ReminderError(f'Reminder {rid} is already done.')
    row = await memory_db.get_reminder(rid)
    return _public(row)


async def due_now(now: datetime | None = None) -> list[dict]:
    """Pending reminders whose due time has passed."""
    now = now or datetime.now(timezone.utc)
    rows = await memory_db.list_pending_reminders()
    return [r for r in rows if from_storage(r['due_at']) <= now]


async def check_once(
    broadcast: Callable[[dict], Awaitable[None]],
    has_listeners: Callable[[], bool],
    now: datetime | None = None,
) -> int:
    """Surface every due reminder once. Nothing is marked surfaced while no UI is
    connected, so a reminder that falls due while the app is closed still reaches
    the next session (late, but not lost)."""
    if not has_listeners():
        return 0
    now = now or datetime.now(timezone.utc)
    due = await due_now(now)
    for row in due:
        await broadcast({
            'type': 'reminder_due',
            'data': {'id': row['id'], 'text': row['text'], 'due_at': row['due_at']},
        })
        await memory_db.mark_reminder_notified(row['id'], to_storage(now))
        logger.info(f'Reminder {row["id"]} surfaced')
    return len(due)


async def run_checker(
    broadcast: Callable[[dict], Awaitable[None]],
    has_listeners: Callable[[], bool],
    interval: float = CHECK_INTERVAL_SECONDS,
):
    while True:
        try:
            await check_once(broadcast, has_listeners)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f'Reminder check failed: {e}')
        await asyncio.sleep(interval)


# --- tools layer -----------------------------------------------------------

async def tool_add_reminder(input_data: dict) -> dict:
    try:
        row = await add(input_data.get('text'), input_data.get('due'))
    except ReminderError as e:
        return {'success': False, 'error': str(e)}
    return {'success': True, 'reminder': row}


async def tool_list_reminders(input_data: dict) -> dict:
    items = await list_open(include_done=bool(input_data.get('include_done', False)))
    return {'success': True, 'reminders': items}


async def tool_complete_reminder(input_data: dict) -> dict:
    try:
        row = await mark_done(input_data.get('id'))
    except (ReminderError, LookupError) as e:
        return {'success': False, 'error': str(e)}
    return {'success': True, 'reminder': row}


# --- REST ------------------------------------------------------------------

class ReminderCreate(BaseModel):
    text: str
    due: str


@router.post('')
async def create_reminder(req: ReminderCreate):
    try:
        return await add(req.text, req.due)
    except ReminderError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get('')
async def get_reminders(include_done: bool = False):
    return {'reminders': await list_open(include_done=include_done)}


@router.post('/{reminder_id}/done')
async def complete(reminder_id: int):
    try:
        return await mark_done(reminder_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ReminderError as e:
        raise HTTPException(status_code=409, detail=str(e))
