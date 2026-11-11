import io
import logging
import re
import wave
from contextlib import asynccontextmanager
from pathlib import Path
import os
import argparse
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).parent / '.env.local')

parser = argparse.ArgumentParser(description='Vertha STT Server')
parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 8765)))
args = parser.parse_args()

STD6_PATH = os.getenv('STD6_PATH', '')  # optional; set only on machines that need an explicit libstdc++ (was a Nix-only path)
LIBZ_PATH = os.getenv('LIBZ_PATH', '')

# Speech in needs GROQ_API_KEY (set it in src/stt/.env.local or the environment; never commit it).
GROQ_API_KEY = (os.getenv('GROQ_API_KEY') or '').strip()
# Second engine, used only when Groq is not set or fails. Model and key are env settings.
OPENAI_API_KEY = (os.getenv('OPENAI_API_KEY') or '').strip()
OPENAI_STT_MODEL = os.getenv('OPENAI_STT_MODEL', 'whisper-1')
OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions'
# Language: empty means auto-detect (Turkish and English both work). Set STT_LANGUAGE=en or tr to pin one.
STT_LANGUAGE = (os.getenv('STT_LANGUAGE') or '').strip()
STT_PROMPT = (os.getenv('STT_PROMPT') or '').strip()
# Keyword wake (no wake-word model needed): listens for WAKE_PHRASE in the transcript. Off unless set.
WAKE_KEYWORD_ENABLED = os.getenv('WAKE_KEYWORD', '').strip().lower() in ('1', 'true', 'on', 'yes')
WAKE_PHRASE = (os.getenv('WAKE_PHRASE') or 'jarvis').strip()
# The wake word is optional. It needs silero_vad, torch, speechbrain and a speaker
# enrollment file, so it stays off unless WAKEWORD_ENABLED=1 is set.
WAKEWORD_ENABLED = os.getenv('WAKEWORD_ENABLED', '').strip().lower() in ('1', 'true', 'on', 'yes')

# Remote access: VERTHA_HOST=0.0.0.0 to listen beyond this machine, and
# VERTHA_CORS_ORIGINS=http://my-laptop:5173,... for the page's origin(s).
BIND_HOST = os.getenv('VERTHA_HOST', '127.0.0.1')
CORS_ORIGINS = [o.strip() for o in os.getenv('VERTHA_CORS_ORIGINS', '').split(',') if o.strip()]
# Groq's hosted Whisper. large-v3 is the most accurate; large-v3-turbo is faster. Set GROQ_MODEL to change it.
GROQ_MODEL = os.getenv('GROQ_MODEL', 'whisper-large-v3')
GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

ENROLLMENT_DIR = os.getenv('ENROLLMENT_DIR', Path(__file__).parent / 'enrollments')

LOG_DIR = Path(__file__).parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

logger = logging.getLogger('vertha-stt')
logger.setLevel(logging.DEBUG)

wakeword_logger = logging.getLogger('vertha-wakeword')
wakeword_logger.setLevel(logging.DEBUG)

fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')

fh = logging.FileHandler(LOG_DIR / 'server.log')
fh.setLevel(logging.DEBUG)
fh.setFormatter(fmt)

ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)
ch.setFormatter(fmt)

logger.addHandler(fh)
logger.addHandler(ch)
wakeword_logger.addHandler(fh)
wakeword_logger.addHandler(ch)

wakeword_detector = None


@asynccontextmanager
async def lifespan(app):
    global wakeword_detector
    logger.info(f'Starting STT server with Groq model: {GROQ_MODEL}')
    engines = speech_engines()
    if engines:
        logger.info(f'Speech in is on. Engines in order: {", ".join(engines)}')
    else:
        logger.warning('Speech in is off: no GROQ_API_KEY or OPENAI_API_KEY. Add one to src/stt/.env.local and restart this server.')
    if WAKE_KEYWORD_ENABLED:
        logger.info(f'Keyword wake is on: phrase "{WAKE_PHRASE}"')
    if not WAKEWORD_ENABLED:
        logger.info('Wake word is off (WAKEWORD_ENABLED not set). The app uses push-to-talk.')
    else:
        try:
            from wakeword import WakeWordDetector
            wakeword_detector = WakeWordDetector()
            wakeword_detector.initialize()
            logger.info('Wake word detector ready')
        except Exception as e:
            logger.error(f'Wake word detector failed to load, falling back to push-to-talk: {e}')
            wakeword_detector = None
    yield


app = FastAPI(title='Vertha STT', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex='https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?',
    allow_origins=CORS_ORIGINS,
    allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['*'],
)


@app.get('/health')
async def health():
    engines = speech_engines()
    return {
        'status': 'ready',
        'model': GROQ_MODEL,
        'speech_in': bool(engines),
        'speech_engines': engines,
        'wakeword': wakeword_detector is not None,
        'wake_keyword': WAKE_KEYWORD_ENABLED and bool(engines),
        'wake_phrase': WAKE_PHRASE,
    }


MIN_AUDIO_SIZE = 5000
MIN_DURATION_MS = 1000

def _estimate_duration_ms(audio_bytes: bytes, content_type: str) -> int:
    try:
        if content_type == 'audio/wav' or audio_bytes[:4] == b'RIFF':
            wav_buffer = io.BytesIO(audio_bytes)
            with wave.open(wav_buffer, 'rb') as wav_file:
                frames = wav_file.getnframes()
                sample_rate = wav_file.getframerate()
                return int((frames / sample_rate) * 1000)
        elif content_type.startswith('audio/webm') or audio_bytes[:4] == b'\x1aE\xdf\xa3':
            pass
    except Exception:
        pass
    return -1


@app.post('/wakeword')
async def detect_wake_word(request: Request):
    if not wakeword_detector:
        # Not an error for the app: it switches to push-to-talk when this is off.
        return {'detected': False, 'enabled': False, 'error': 'Wake word is off on this server'}

    file = await request.body()
    logger.debug(f'/wakeword: {len(file)} bytes')
    if not file:
        return {'detected': False, 'error': 'No audio data'}

    try:
        detected_models = wakeword_detector.process_audio(file)
        detected = len(detected_models) > 0
        logger.debug(f'/wakeword result: detected={detected}')
        return {
            'detected': detected,
            'models': detected_models if detected else [],
        }
    except Exception as e:
        logger.error(f'Wake word detection error: {e}')
        return {'detected': False, 'error': str(e)}


@app.post('/debug/verify')
async def debug_verify_speaker(request: Request):
    if not wakeword_detector:
        return {'error': 'Wake word detector not initialized'}

    file = await request.body()
    logger.info(f'/debug/verify: {len(file)} bytes')

    if not file:
        return {'error': 'No audio data'}

    try:
        import numpy as np
        import io
        import wave

        pcm_data = wakeword_detector._convert_to_pcm(file, 16000)
        if pcm_data is None:
            return {'error': 'Could not convert audio to PCM'}

        min_samples = int(0.3 * 16000)
        if len(pcm_data) < min_samples:
            return {
                'error': f'Audio too short: {len(pcm_data)} samples (need {min_samples})',
                'samples': len(pcm_data),
                'needed': min_samples,
            }

        import torch
        speech_tensor = torch.FloatTensor(pcm_data)

        with torch.no_grad():
            embedding = wakeword_detector.verification_model.encode_batch(speech_tensor.unsqueeze(0))

        cos_sim = torch.nn.functional.cosine_similarity(
            embedding.squeeze(0),
            wakeword_detector.enrolled_embedding
        ).item()

        logger.info(f'Debug verify: cosine_similarity={cos_sim:.4f}, threshold={wakeword_detector._get_threshold()}')

        return {
            'cosine_similarity': round(cos_sim, 4),
            'threshold': wakeword_detector._get_threshold(),
            'verified': cos_sim > wakeword_detector._get_threshold(),
            'samples': len(pcm_data),
            'duration_ms': round(len(pcm_data) / 16000 * 1000, 1),
        }
    except Exception as e:
        logger.error(f'Debug verify error: {e}')
        import traceback
        traceback.print_exc()
        return {'error': str(e)}


# The browser records webm/opus (or ogg/mp4 on some browsers). Groq and OpenAI pick the decoder
# from the file name, so the name must match what the browser actually sent.
AUDIO_EXTENSIONS = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
}


class SpeechUnavailable(Exception):
    """No speech engine is configured (no key set)."""


class SpeechFailed(Exception):
    """Every configured engine failed for this audio."""


def speech_engines() -> list[str]:
    """Engines with a key set, in the order they are tried."""
    engines = []
    if GROQ_API_KEY:
        engines.append('groq')
    if OPENAI_API_KEY:
        engines.append('openai')
    return engines


def _mime_and_name(content_type: str, audio: bytes) -> tuple[str, str]:
    ext = AUDIO_EXTENSIONS.get(content_type)
    if ext is None:
        ext = 'wav' if audio[:4] == b'RIFF' else 'webm'
    mime = content_type if content_type.startswith('audio/') else f'audio/{ext}'
    return f'audio.{ext}', mime


async def _post_transcription(url: str, api_key: str, model: str, label: str,
                              audio: bytes, content_type: str, verbose: bool):
    filename, mime = _mime_and_name(content_type, audio)
    data = {'model': model, 'temperature': 0}
    data['response_format'] = 'verbose_json' if verbose else 'json'
    # Language is auto-detected unless STT_LANGUAGE pins it; the prompt is an optional hint.
    if STT_LANGUAGE:
        data['language'] = STT_LANGUAGE
    if STT_PROMPT:
        data['prompt'] = STT_PROMPT
    headers = {'Authorization': f'Bearer {api_key}'}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, files={'file': (filename, audio, mime)}, data=data, headers=headers)
    except httpx.TimeoutException:
        raise SpeechFailed(f'{label} timed out')
    except httpx.RequestError as e:
        raise SpeechFailed(f'could not reach {label} ({type(e).__name__})')
    if response.status_code in (401, 403):
        raise SpeechFailed(f'{label} rejected its key')
    if response.status_code >= 400:
        raise SpeechFailed(f'{label} answered {response.status_code}')
    body = response.json()
    return (body.get('text') or '').strip(), body.get('language')


async def transcribe_audio(audio: bytes, content_type: str) -> dict:
    """Groq Whisper first, then OpenAI Whisper, each only if its key is set.

    Audio goes to the engine byte for byte: no resampling, no re-encoding.
    """
    engines = speech_engines()
    if not engines:
        raise SpeechUnavailable(
            'Speech in is off: no speech key is set on the speech server. Add GROQ_API_KEY '
            '(or OPENAI_API_KEY) to src/stt/.env.local and restart it. The app falls back to browser speech.'
        )
    errors = []
    for engine in engines:
        try:
            if engine == 'groq':
                text, language = await _post_transcription(
                    GROQ_URL, GROQ_API_KEY, GROQ_MODEL, 'Groq', audio, content_type, verbose=True)
            else:
                text, language = await _post_transcription(
                    OPENAI_URL, OPENAI_API_KEY, OPENAI_STT_MODEL, 'OpenAI', audio, content_type, verbose=False)
            logger.info(f'Transcribed with {engine}: "{text[:80]}{"..." if len(text) > 80 else ""}"')
            return {'text': text, 'engine': engine, 'language': language}
        except SpeechFailed as e:
            logger.error(f'Speech engine {engine} failed: {e}')
            errors.append(str(e))
    raise SpeechFailed('; '.join(errors))


def match_wake_phrase(transcript: str, phrase: str) -> tuple[bool, str]:
    """Whole-word match of the wake phrase in a transcript.

    Returns (found, rest): rest is whatever was said after the phrase, so
    "jarvis what's the weather" carries the command with it.
    """
    target = [t.lower() for t in re.findall(r'\w+', phrase)]
    if not target:
        return False, ''
    tokens = list(re.finditer(r'\w+', transcript))
    lowered = [m.group(0).lower() for m in tokens]
    n = len(target)
    for i in range(len(lowered) - n + 1):
        if lowered[i:i + n] == target:
            rest = transcript[tokens[i + n - 1].end():].strip(' \t\r\n.,!?;:-')
            return True, rest
    return False, ''


@app.post('/transcribe')
async def transcribe(file: UploadFile = File(...)):
    content = await file.read()
    content_type = (file.content_type or 'audio/webm').split(';')[0].strip().lower()
    logger.info(f'/transcribe: {len(content)} bytes, type={content_type}')

    if len(content) < MIN_AUDIO_SIZE:
        logger.info(f'Audio too small ({len(content)} bytes), skipping')
        return {'text': '', 'engine': None}

    duration_ms = _estimate_duration_ms(content, content_type)
    if duration_ms > 0 and duration_ms < MIN_DURATION_MS:
        logger.info(f'Audio too short ({duration_ms}ms), skipping')
        return {'text': '', 'engine': None}

    try:
        result = await transcribe_audio(content, content_type)
        return {'text': result['text'], 'engine': result['engine'], 'language': result['language']}
    except SpeechUnavailable as e:
        logger.warning(str(e))
        return JSONResponse({'error': str(e), 'engine': None}, status_code=503)
    except SpeechFailed as e:
        return JSONResponse({'error': f'Speech in failed: {e}', 'engine': None}, status_code=502)


@app.post('/wake/keyword')
async def wake_keyword(request: Request):
    """Keyword wake: transcribe a short window and look for the wake phrase.

    Runs on the transcript from the speech engine, so it needs a speech key set.
    Only a detection leaves this route; the words of a window that did not match are dropped.
    """
    if not WAKE_KEYWORD_ENABLED:
        return {'detected': False, 'enabled': False, 'error': 'Keyword wake is off (set WAKE_KEYWORD=on)'}
    audio = await request.body()
    if len(audio) < MIN_AUDIO_SIZE:
        return {'detected': False, 'enabled': True}
    content_type = (request.headers.get('content-type') or 'audio/wav').split(';')[0].strip().lower()
    try:
        result = await transcribe_audio(audio, content_type)
    except SpeechUnavailable as e:
        return JSONResponse({'detected': False, 'enabled': True, 'error': str(e)}, status_code=503)
    except SpeechFailed as e:
        return JSONResponse({'detected': False, 'enabled': True, 'error': f'Speech in failed: {e}'}, status_code=502)
    found, rest = match_wake_phrase(result['text'], WAKE_PHRASE)
    return {
        'detected': found,
        'enabled': True,
        'phrase': WAKE_PHRASE,
        'command': rest if found else '',
        'engine': result['engine'],
    }


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host=BIND_HOST, port=args.port, log_level='info')