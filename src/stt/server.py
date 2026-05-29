import io
import logging
import wave
from contextlib import asynccontextmanager
from pathlib import Path
import os
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).parent / '.env.local')

STD6_PATH = os.getenv('STD6_PATH', '/nix/store/chqq8mpmpyfi9kgsngya71akv5xicn03-gcc-15.2.0-lib/lib/libstdc++.so.6.0.34')
LIBZ_PATH = os.getenv('LIBZ_PATH', '')

GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GROQ_MODEL = os.getenv('GROQ_MODEL', 'whisper-large-v3-turbo')
GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

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
    if GROQ_API_KEY:
        logger.info('Groq API key configured')
    else:
        logger.error('GROQ_API_KEY not found in environment')
    try:
        from wakeword import WakeWordDetector
        wakeword_detector = WakeWordDetector()
        wakeword_detector.initialize()
        logger.info('Wake word detector ready')
    except Exception as e:
        logger.error(f'Wake word detector failed to load: {e}')
        wakeword_detector = None
    yield


app = FastAPI(title='Vertha STT', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex='https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?',
    allow_methods=['GET', 'POST', 'OPTIONS'],
    allow_headers=['*'],
)


@app.get('/health')
async def health():
    return {'status': 'ready', 'model': GROQ_MODEL}


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
        return {'detected': False, 'error': 'Wake word detector not initialized'}

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


@app.post('/transcribe')
async def transcribe(file: UploadFile = File(...)):
    if not GROQ_API_KEY:
        logger.error('GROQ_API_KEY not configured')
        return JSONResponse({'error': 'STT not configured'}, status_code=500)

    content = await file.read()
    content_type = file.content_type or 'audio/webm'
    logger.info(f'/transcribe: {len(content)} bytes, type={content_type}')

    if len(content) < MIN_AUDIO_SIZE:
        logger.info(f'Audio too small ({len(content)} bytes), skipping')
        return {'text': ''}

    duration_ms = _estimate_duration_ms(content, content_type)
    if duration_ms > 0 and duration_ms < MIN_DURATION_MS:
        logger.info(f'Audio too short ({duration_ms}ms), skipping')
        return {'text': ''}

    try:
        audio_bytes = content
        filename = 'audio.wav'
        mime_type = 'audio/wav'

        files = {'file': (filename, audio_bytes, mime_type)}
        data = {
            'model': GROQ_MODEL,
            'language': 'en',
            'temperature': 0.2,
            'response_format': 'text',
        }
        headers = {'Authorization': f'Bearer {GROQ_API_KEY}'}

        logger.info(f'Transcribing with Groq...')
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(GROQ_URL, files=files, data=data, headers=headers)
            response.raise_for_status()
            text = response.text.strip()

        logger.info(f'Transcribed: "{text[:80]}{"..." if len(text) > 80 else ""}"')
        return {'text': text}

    except httpx.TimeoutException:
        logger.error('Groq API timeout')
        return JSONResponse({'error': 'Transcription timeout'}, status_code=504)
    except httpx.HTTPStatusError as e:
        logger.error(f'Groq API HTTP error: {e.response.status_code}')
        return JSONResponse({'error': f'Groq API error: {e.response.status_code}'}, status_code=500)
    except httpx.RequestError as e:
        logger.error(f'Groq API request error: {e}')
        return JSONResponse({'error': str(e)}, status_code=500)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8765, log_level='info')