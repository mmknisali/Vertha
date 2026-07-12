import importlib.util
import pytest
import sys
import os
from pathlib import Path
from unittest.mock import patch

# Add src/stt to sys.path so submodule imports (wakeword, etc.) resolve
_src_stt = str(Path(__file__).parent.parent.parent / 'src' / 'stt')
if _src_stt not in sys.path:
    sys.path.insert(0, _src_stt)

# Load STT server with patched env/argv so module-level code runs with test values
_test_env = {
    'GROQ_API_KEY': 'test-key',
    'PORT': '8765',
    'ENROLLMENT_DIR': str(Path(__file__).parent.parent.parent / 'enrollments'),
}
with patch.dict(os.environ, _test_env, clear=False), \
     patch.object(sys, 'argv', ['pytest', '--port', '8765']):
    _stt_spec = importlib.util.spec_from_file_location(
        'stt_server',
        str(Path(__file__).parent.parent.parent / 'src' / 'stt' / 'server.py')
    )
    stt_server = importlib.util.module_from_spec(_stt_spec)
    _stt_spec.loader.exec_module(stt_server)


@pytest.fixture(autouse=True)
def mock_env():
    with patch.dict(os.environ, _test_env, clear=False):
        yield


@pytest.fixture(autouse=True)
def mock_argv():
    with patch.object(sys, 'argv', ['pytest', '--port', '8765']):
        yield


class TestSTTServer:
    def test_port_configuration(self):
        assert stt_server.args.port == 8765

    def test_groq_model_default(self):
        assert stt_server.GROQ_MODEL == 'whisper-large-v3-turbo'

    def test_groq_url(self):
        assert stt_server.GROQ_URL == 'https://api.groq.com/openai/v1/audio/transcriptions'

    def test_min_audio_size(self):
        assert stt_server.MIN_AUDIO_SIZE == 5000

    def test_min_duration_ms(self):
        assert stt_server.MIN_DURATION_MS == 1000


class TestHealthEndpoint:
    def test_health_returns_ready(self):
        from fastapi.testclient import TestClient
        client = TestClient(stt_server.app)
        response = client.get('/health')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'ready'
        assert 'model' in data


class TestTranscribeEndpoint:
    def test_transcribe_requires_api_key(self):
        from fastapi.testclient import TestClient
        with patch.object(stt_server, 'GROQ_API_KEY', None):
            client = TestClient(stt_server.app)
            response = client.post(
                '/transcribe',
                files={'file': ('test.wav', b'audio', 'audio/wav')}
            )
            assert response.status_code == 500


class TestWakeWordEndpoint:
    def test_wakeword_requires_audio(self):
        from fastapi.testclient import TestClient
        client = TestClient(stt_server.app)
        response = client.post(
            '/wakeword',
            content=b''
        )
        assert response.status_code == 200
        data = response.json()
        assert data['detected'] == False


class TestDurationEstimation:
    def test_estimate_duration_invalid(self):
        duration = stt_server._estimate_duration_ms(b'invalid', 'audio/wav')
        assert duration == -1
