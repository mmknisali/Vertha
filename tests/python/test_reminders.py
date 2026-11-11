import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_src_tts = str(Path(__file__).parent.parent.parent / 'src' / 'tts')
if _src_tts not in sys.path:
    sys.path.insert(0, _src_tts)

import reminders  # noqa: E402
from memory import db as memory_db  # noqa: E402
from reminders import ReminderError, parse_due  # noqa: E402
from tool_executor import ToolExecutor  # noqa: E402

NOW = datetime(2026, 11, 11, 9, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def store(tmp_path, monkeypatch):
    """A fresh SQLite store in a temp dir; the app's own schema and code run on it."""
    monkeypatch.setattr(memory_db, 'MEMORY_PATH', tmp_path)
    monkeypatch.setattr(memory_db, 'DB_PATH', tmp_path / 'vertha.db')
    asyncio.run(memory_db.init_db())
    return tmp_path


def run(coro):
    return asyncio.run(coro)


# --- parsing ---------------------------------------------------------------

class TestParseDue:
    def test_relative_minutes(self):
        assert parse_due('in 30 minutes', NOW) == NOW + timedelta(minutes=30)

    def test_relative_units_and_singular(self):
        assert parse_due('in 1 hour', NOW) == NOW + timedelta(hours=1)
        assert parse_due('in 2 days', NOW) == NOW + timedelta(days=2)
        assert parse_due('in 45 seconds', NOW) == NOW + timedelta(seconds=45)

    def test_iso_with_offset_is_converted_to_utc(self):
        due = parse_due('2026-11-11T08:00:00+03:00', NOW)
        assert due == datetime(2026, 11, 11, 5, 0, 0, tzinfo=timezone.utc)

    def test_iso_zulu(self):
        assert parse_due('2026-11-11T12:30:00Z', NOW) == datetime(2026, 11, 11, 12, 30, tzinfo=timezone.utc)

    def test_naive_iso_is_server_local_time(self):
        naive = datetime(2026, 11, 11, 18, 15)
        assert parse_due('2026-11-11T18:15', NOW) == naive.astimezone().astimezone(timezone.utc)

    def test_empty_is_rejected(self):
        with pytest.raises(ReminderError):
            parse_due('   ', NOW)

    def test_zero_relative_is_rejected(self):
        with pytest.raises(ReminderError):
            parse_due('in 0 minutes', NOW)

    def test_gibberish_is_rejected(self):
        with pytest.raises(ReminderError):
            parse_due('sometime after lunch', NOW)


# --- store round trip ------------------------------------------------------

class TestStore:
    def test_add_list_done(self, store):
        added = run(reminders.add('call the dentist', 'in 30 minutes', NOW))
        assert added['id'] > 0
        assert added['text'] == 'call the dentist'
        assert added['due_at'] == '2026-11-11T09:30:00Z'
        assert added['done'] is False

        open_items = run(reminders.list_open())
        assert [r['id'] for r in open_items] == [added['id']]

        done = run(reminders.mark_done(added['id'], NOW))
        assert done['done'] is True
        assert run(reminders.list_open()) == []
        assert [r['id'] for r in run(reminders.list_open(include_done=True))] == [added['id']]

    def test_list_orders_by_due_time(self, store):
        run(reminders.add('later', 'in 2 hours', NOW))
        run(reminders.add('sooner', 'in 10 minutes', NOW))
        texts = [r['text'] for r in run(reminders.list_open())]
        assert texts == ['sooner', 'later']

    def test_blank_text_is_rejected(self, store):
        with pytest.raises(ReminderError):
            run(reminders.add('   ', 'in 5 minutes', NOW))

    def test_done_twice_is_refused(self, store):
        added = run(reminders.add('x', 'in 5 minutes', NOW))
        run(reminders.mark_done(added['id'], NOW))
        with pytest.raises(ReminderError):
            run(reminders.mark_done(added['id'], NOW))

    def test_done_unknown_id_is_not_found(self, store):
        with pytest.raises(LookupError):
            run(reminders.mark_done(9999, NOW))

    def test_done_non_numeric_id_is_rejected(self, store):
        with pytest.raises(ReminderError):
            run(reminders.mark_done('abc', NOW))


# --- background check ------------------------------------------------------

class Recorder:
    def __init__(self):
        self.sent = []

    async def __call__(self, message):
        self.sent.append(message)


class TestChecker:
    def test_not_due_yet_surfaces_nothing(self, store):
        run(reminders.add('later', 'in 1 hour', NOW))
        rec = Recorder()
        count = run(reminders.check_once(rec, lambda: True, now=NOW))
        assert count == 0 and rec.sent == []

    def test_due_is_surfaced_once(self, store):
        added = run(reminders.add('stretch', 'in 5 minutes', NOW))
        rec = Recorder()
        later = NOW + timedelta(minutes=6)
        assert run(reminders.check_once(rec, lambda: True, now=later)) == 1
        assert rec.sent == [{
            'type': 'reminder_due',
            'data': {'id': added['id'], 'text': 'stretch', 'due_at': '2026-11-11T09:05:00Z'},
        }]
        # a second pass does not repeat it
        assert run(reminders.check_once(rec, lambda: True, now=later + timedelta(minutes=1))) == 0
        assert len(rec.sent) == 1

    def test_done_reminder_never_fires(self, store):
        added = run(reminders.add('skip me', 'in 1 minute', NOW))
        run(reminders.mark_done(added['id'], NOW))
        rec = Recorder()
        assert run(reminders.check_once(rec, lambda: True, now=NOW + timedelta(hours=1))) == 0
        assert rec.sent == []

    def test_no_listener_keeps_reminder_pending(self, store):
        run(reminders.add('wake up', 'in 1 minute', NOW))
        rec = Recorder()
        later = NOW + timedelta(minutes=2)
        assert run(reminders.check_once(rec, lambda: False, now=later)) == 0
        assert rec.sent == []
        # once a UI is connected, the overdue reminder is surfaced
        assert run(reminders.check_once(rec, lambda: True, now=later)) == 1
        assert len(rec.sent) == 1


# --- tools layer -----------------------------------------------------------

class TestToolExecutorWiring:
    def test_add_list_complete_through_tool_executor(self, store):
        ex = ToolExecutor()
        added = run(ex.execute('add_reminder', {'text': 'water the plants', 'due': 'in 20 minutes'}))
        assert added['success'] is True
        rid = added['reminder']['id']

        listed = run(ex.execute('list_reminders', {}))
        assert listed['success'] is True
        assert [r['id'] for r in listed['reminders']] == [rid]

        completed = run(ex.execute('complete_reminder', {'id': rid}))
        assert completed['success'] is True and completed['reminder']['done'] is True

    def test_tool_errors_come_back_as_results_not_exceptions(self, store):
        ex = ToolExecutor()
        bad = run(ex.execute('add_reminder', {'text': 'x', 'due': 'whenever'}))
        assert bad['success'] is False and 'whenever' in bad['error']
        missing = run(ex.execute('complete_reminder', {'id': 404}))
        assert missing['success'] is False


# --- REST ------------------------------------------------------------------

@pytest.fixture
def client(store):
    app = FastAPI()
    app.include_router(reminders.router)
    return TestClient(app)


class TestRest:
    def test_create_list_done(self, client):
        created = client.post('/reminders', json={'text': 'take the bins out', 'due': 'in 15 minutes'})
        assert created.status_code == 200
        rid = created.json()['id']

        listed = client.get('/reminders').json()['reminders']
        assert [r['id'] for r in listed] == [rid]

        done = client.post(f'/reminders/{rid}/done')
        assert done.status_code == 200 and done.json()['done'] is True
        assert client.get('/reminders').json()['reminders'] == []

    def test_bad_due_is_400(self, client):
        resp = client.post('/reminders', json={'text': 'x', 'due': 'eventually'})
        assert resp.status_code == 400

    def test_unknown_id_is_404_and_repeat_done_is_409(self, client):
        assert client.post('/reminders/12345/done').status_code == 404
        rid = client.post('/reminders', json={'text': 'y', 'due': 'in 5 minutes'}).json()['id']
        client.post(f'/reminders/{rid}/done')
        assert client.post(f'/reminders/{rid}/done').status_code == 409
