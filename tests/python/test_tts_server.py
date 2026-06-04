import pytest
import sys
import os
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'src' / 'tts'))


@pytest.fixture(autouse=True)
def mock_env():
    test_env = {
        'PIPER_VOICE': '/nonexistent/path.onnx',
        'PORT': '8766',
    }
    with patch.dict(os.environ, test_env, clear=False):
        yield


@pytest.fixture(autouse=True)
def mock_argv():
    with patch.object(sys, 'argv', ['pytest', '--port', '8766']):
        yield


class TestTTSServer:
    def test_port_configuration(self):
        from server import args
        assert args.port == 8766

    def test_max_chunk_chars(self):
        from server import MAX_CHUNK_CHARS
        assert MAX_CHUNK_CHARS == 200


class TestHealthEndpoint:
    def test_health_endpoint_exists(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.get('/health')
        assert response.status_code == 200
        data = response.json()
        assert 'status' in data
        assert 'engine' in data


class TestTextSplitting:
    def test_split_text_empty(self):
        from server import split_text
        result = split_text('')
        assert result == []

    def test_split_text_single_sentence(self):
        from server import split_text
        result = split_text('Hello world.')
        assert len(result) == 1
        assert result[0] == 'Hello world.'

    def test_split_text_multiple_sentences(self):
        from server import split_text
        result = split_text('First sentence. Second sentence. Third sentence.')
        assert len(result) > 1

    def test_split_text_long_text(self):
        from server import split_text
        long_text = 'This is a longer piece of text ' * 50
        result = split_text(long_text)
        assert len(result) > 1
        for chunk in result:
            assert len(chunk) <= 200

    def test_split_text_whitespace_handling(self):
        from server import split_text
        result = split_text('  Hello.  World.  ')
        assert all(c.strip() for c in result)


class TestWavGeneration:
    def test_make_wav_bytes(self):
        import wave
        import io
        from server import make_wav_bytes

        audio = b'\x00\x00' * 1000
        wav = make_wav_bytes(audio, 22050, 2, 1)

        assert wav[:4] == b'RIFF'
        assert wav[8:12] == b'WAVE'

        buffer = io.BytesIO(wav)
        with wave.open(buffer, 'rb') as w:
            assert w.getnchannels() == 1
            assert w.getsampwidth() == 2
            assert w.getframerate() == 22050


class TestSpeakEndpoint:
    def test_speak_empty_text_returns_empty_wav(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.post('/speak', json={'text': ''})
        assert response.status_code == 200


class TestContextResolve:
    def test_context_resolve_endpoint(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.post(
            '/context/resolve',
            json={'message': 'hello', 'history': []}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'resolved_message' in data


class TestEmotionDetection:
    def test_emotion_endpoint(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.post(
            '/conversation/emotion',
            json={'message': 'I am happy'}
        )
        assert response.status_code == 200
        data = response.json()
        assert 'emotion' in data


class TestTaskAbort:
    def test_abort_task_endpoint(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.post('/tasks/abort')
        assert response.status_code == 200
        data = response.json()
        assert data['success'] == True


class TestTaskCurrent:
    def test_current_task_returns_inactive_when_no_task(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.get('/tasks/current')
        assert response.status_code == 200
        data = response.json()
        assert data['active'] == False


class TestTaskHistory:
    def test_task_history_endpoint(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.get('/tasks/history')
        assert response.status_code == 200
        data = response.json()
        assert 'tasks' in data