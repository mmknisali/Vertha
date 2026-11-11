import asyncio
import sys
from pathlib import Path

import httpx
import pytest
from fastapi import HTTPException

_src_tts = str(Path(__file__).parent.parent.parent / 'src' / 'tts')
if _src_tts not in sys.path:
    sys.path.insert(0, _src_tts)

import spotify  # noqa: E402


def run(coro):
    return asyncio.run(coro)



def _spotify_transport(status, body=None, seen=None):
    def handler(request):
        if seen is not None:
            seen.append(request)
        return httpx.Response(status, json=body) if body is not None else httpx.Response(status)
    return httpx.MockTransport(handler)


@pytest.fixture
def spotify_http(monkeypatch):
    monkeypatch.setattr(spotify, 'get_access_token', lambda: _const('token'))
    real_client = httpx.AsyncClient
    state = {'transport': None}

    def factory(*args, **kwargs):
        kwargs['transport'] = state['transport']
        return real_client(*args, **kwargs)

    monkeypatch.setattr(httpx, 'AsyncClient', factory)
    return state


async def _const(value):
    return value


class TestSpotify:
    def test_no_active_device_becomes_404_with_spotify_message(self, spotify_http):
        spotify_http['transport'] = _spotify_transport(
            404, {'error': {'status': 404, 'message': 'No active device found'}})
        with pytest.raises(HTTPException) as exc:
            run(spotify.sp_put('/me/player/play', json_data={}))
        assert exc.value.status_code == 404
        assert exc.value.detail == 'Spotify: No active device found'

    def test_spotify_server_error_becomes_502(self, spotify_http):
        spotify_http['transport'] = _spotify_transport(503)
        with pytest.raises(HTTPException) as exc:
            run(spotify.sp_put('/me/player/volume'))
        assert exc.value.status_code == 502

    def test_204_is_success(self, spotify_http):
        spotify_http['transport'] = _spotify_transport(204)
        assert run(spotify.sp_put('/me/player/pause')) == {'status': 'ok'}

    def test_episode_uri_is_sent_as_uris(self, spotify_http, monkeypatch):
        sent = {}

        async def fake_put(endpoint, json_data=None, params=None):
            sent['endpoint'] = endpoint
            sent['json'] = json_data
            return {'status': 'ok'}

        monkeypatch.setattr(spotify, 'sp_put', fake_put)
        result = run(spotify.play(episode_uri='spotify:episode:abc'))
        assert result == {'status': 'playing'}
        assert sent == {'endpoint': '/me/player/play', 'json': {'uris': ['spotify:episode:abc']}}

    def test_context_uri_still_works(self, spotify_http, monkeypatch):
        sent = {}

        async def fake_put(endpoint, json_data=None, params=None):
            sent['json'] = json_data
            return {'status': 'ok'}

        monkeypatch.setattr(spotify, 'sp_put', fake_put)
        run(spotify.play(context_uri='spotify:album:xyz'))
        assert sent['json'] == {'context_uri': 'spotify:album:xyz'}

    def test_play_needs_some_uri(self, spotify_http):
        with pytest.raises(HTTPException) as exc:
            run(spotify.play())
        assert exc.value.status_code == 400
