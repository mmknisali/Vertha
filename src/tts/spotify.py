import asyncio
import httpx
import base64
import logging
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException

logger = logging.getLogger('vertha-spotify')

router = APIRouter(prefix='/spotify', tags=['spotify'])

SPOTIFY_API = 'https://api.spotify.com/v1'
SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com'

SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID', '')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET', '')
REDIRECT_URI = 'http://127.0.0.1:8766/callback'

ACCESS_TOKEN = None
REFRESH_TOKEN = None
TOKEN_EXPIRES_AT = 0
sleep_task = None


def load_tokens():
    global ACCESS_TOKEN, REFRESH_TOKEN, TOKEN_EXPIRES_AT
    tokens_file = Path(__file__).parent / '.tokens.json'
    if tokens_file.exists():
        import json
        data = json.loads(tokens_file.read_text())
        ACCESS_TOKEN = data.get('access_token')
        REFRESH_TOKEN = data.get('refresh_token')
        TOKEN_EXPIRES_AT = data.get('expires_at', 0)


def save_tokens():
    import json
    tokens_file = Path(__file__).parent / '.tokens.json'
    tokens_file.write_text(json.dumps({
        'access_token': ACCESS_TOKEN,
        'refresh_token': REFRESH_TOKEN,
        'expires_at': TOKEN_EXPIRES_AT,
    }))


async def get_access_token() -> str:
    global ACCESS_TOKEN, REFRESH_TOKEN, TOKEN_EXPIRES_AT

    load_tokens()

    current_time_s = asyncio.get_event_loop().time()
    if ACCESS_TOKEN and TOKEN_EXPIRES_AT / 1000 > current_time_s:
        return ACCESS_TOKEN

    if not REFRESH_TOKEN:
        raise HTTPException(
            status_code=401,
            detail='Spotify not authenticated. Visit /spotify/auth to begin.'
        )

    creds = base64.b64encode(f'{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}'.encode()).decode()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f'{SPOTIFY_ACCOUNTS}/api/token',
            headers={'Authorization': f'Basic {creds}'},
            data={
                'grant_type': 'refresh_token',
                'refresh_token': REFRESH_TOKEN,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    ACCESS_TOKEN = data['access_token']
    REFRESH_TOKEN = data.get('refresh_token', REFRESH_TOKEN)
    TOKEN_EXPIRES_AT = asyncio.get_event_loop().time() * 1000 + data['expires_in'] * 1000
    save_tokens()
    logger.info('Spotify token refreshed')
    return ACCESS_TOKEN


async def sp_put(endpoint: str, json_data=None, params=None):
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.put(
            f'{SPOTIFY_API}{endpoint}',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json=json_data,
            params=params,
        )
        if resp.status_code == 204:
            return {'status': 'ok'}
        resp.raise_for_status()
        return resp


async def sp_post(endpoint: str, json_data=None, params=None):
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f'{SPOTIFY_API}{endpoint}',
            headers={'Authorization': f'Bearer {token}'},
            json=json_data,
            params=params,
        )
        resp.raise_for_status()
        return resp


async def sp_get(endpoint: str, params=None):
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f'{SPOTIFY_API}{endpoint}',
            headers={'Authorization': f'Bearer {token}'},
            params=params,
        )
        resp.raise_for_status()
        return resp


@router.get('/auth')
async def auth_url():
    scope = 'user-modify-playback-state user-read-playback-state'
    url = (
        f'{SPOTIFY_ACCOUNTS}/authorize'
        f'?client_id={SPOTIFY_CLIENT_ID}'
        f'&response_type=code'
        f'&redirect_uri={REDIRECT_URI}'
        f'&scope={scope}'
    )
    return {'auth_url': url}


@router.get('/callback')
async def callback(code: str):
    global ACCESS_TOKEN, REFRESH_TOKEN, TOKEN_EXPIRES_AT

    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail='Spotify credentials not configured')

    creds = base64.b64encode(f'{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}'.encode()).decode()
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f'{SPOTIFY_ACCOUNTS}/api/token',
            headers={'Authorization': f'Basic {creds}'},
            data={
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': REDIRECT_URI,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    ACCESS_TOKEN = data['access_token']
    REFRESH_TOKEN = data['refresh_token']
    TOKEN_EXPIRES_AT = asyncio.get_event_loop().time() * 1000 + data['expires_in'] * 1000
    save_tokens()
    logger.info('Spotify authenticated successfully')
    return {'status': 'authenticated'}


@router.post('/volume')
async def set_volume(volume: int):
    if not 0 <= volume <= 100:
        raise HTTPException(status_code=400, detail='Volume must be 0-100')
    await sp_put('/me/player/volume', params={'volume_percent': volume})
    logger.info(f'Volume set to {volume}')
    return {'volume': volume}


@router.put('/play')
async def play(context_uri: str):
    await sp_put(
        '/me/player/play',
        json_data={'context_uri': context_uri},
    )
    logger.info(f'Playing {context_uri}')
    return {'status': 'playing'}


@router.put('/pause')
async def pause():
    await sp_put('/me/player/pause')
    logger.info('Paused playback')
    return {'status': 'paused'}


@router.get('/status')
async def status():
    try:
        token = await get_access_token()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f'{SPOTIFY_API}/me/player',
                headers={'Authorization': f'Bearer {token}'},
            )
            if resp.status_code == 204:
                return {'playing': False, 'message': 'No active device. Open Spotify and start playing something.'}
            return resp.json()
    except Exception as e:
        return {'playing': False, 'error': str(e)}


@router.post('/sleep-timer/start')
async def start_sleep_timer(duration_minutes: int = 45):
    global sleep_task

    if sleep_task and not sleep_task.done():
        sleep_task.cancel()

    async def sleep_then_pause():
        await asyncio.sleep(duration_minutes * 60)
        try:
            await pause()
            logger.info('Sleep timer triggered - paused playback')
        except Exception as e:
            logger.error(f'Sleep timer pause failed: {e}')

    sleep_task = asyncio.create_task(sleep_then_pause())
    logger.info(f'Sleep timer started: {duration_minutes} min')
    return {'status': 'started', 'duration_minutes': duration_minutes}


@router.post('/sleep-timer/cancel')
async def cancel_sleep_timer():
    global sleep_task
    if sleep_task and not sleep_task.done():
        sleep_task.cancel()
        sleep_task = None
        logger.info('Sleep timer cancelled')
        return {'status': 'cancelled'}
    return {'status': 'no active timer'}


load_tokens()