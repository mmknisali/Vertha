import pytest
import sys
import os
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'src' / 'stt'))


@pytest.fixture(autouse=True)
def mock_env():
    test_env = {
        'GROQ_API_KEY': 'test-key',
        'PORT': '8765',
        'ENROLLMENT_DIR': str(Path(__file__).parent.parent.parent / 'enrollments'),
    }
    with patch.dict(os.environ, test_env, clear=False):
        yield


@pytest.fixture(autouse=True)
def mock_argv():
    with patch.object(sys, 'argv', ['pytest', '--port', '8765']):
        yield


class TestSTTServer:
    def test_port_configuration(self):
        from server import args
        assert args.port == 8765

    def test_groq_model_default(self):
        from server import GROQ_MODEL
        assert GROQ_MODEL == 'whisper-large-v3-turbo'

    def test_groq_url(self):
        from server import GROQ_URL
        assert GROQ_URL == 'https://api.groq.com/openai/v1/audio/transcriptions'

    def test_min_audio_size(self):
        from server import MIN_AUDIO_SIZE
        assert MIN_AUDIO_SIZE == 5000

    def test_min_duration_ms(self):
        from server import MIN_DURATION_MS
        assert MIN_DURATION_MS == 1000


class TestHealthEndpoint:
    def test_health_returns_ready(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.get('/health')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'ready'
        assert 'model' in data


class TestTranscribeEndpoint:
    def test_transcribe_requires_api_key(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.post(
            '/transcribe',
            files={'file': ('test.wav', b'audio', 'audio/wav')}
        )
        assert response.status_code == 500


class TestWakeWordEndpoint:
    def test_wakeword_requires_audio(self):
        from fastapi.testclient import TestClient
        from server import app
        client = TestClient(app)
        response = client.post(
            '/wakeword',
            content=b''
        )
        assert response.status_code == 200
        data = response.json()
        assert data['detected'] == False


class TestDurationEstimation:
    def test_estimate_duration_invalid(self):
        from server import _estimate_duration_ms
        duration = _estimate_duration_ms(b'invalid', 'audio/wav')
        assert duration == -1