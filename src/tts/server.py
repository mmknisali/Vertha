import asyncio
import io
import json
import logging
import os
import re
import wave
import argparse
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env.local')

parser = argparse.ArgumentParser(description='Vertha TTS Server')
parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 8766)))
args = parser.parse_args()

import httpx
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from websocket_manager import get_ws_manager

from weather import router as weather_router
from spotify import router as spotify_router
from memory import db as memory_db, embeddings as memory_embeddings
from memory.router import router as memory_router, get_session_id, set_session_id, current_session_id
from memory.search import router as search_router
from routers.pc_control import router as pc_router
from reminders import router as reminders_router, run_checker as run_reminder_checker

from task_engine import TaskEngine, get_task_engine, set_task_engine
from stream_parser import StreamParser, strip_tags_for_tts
from tool_executor import get_tool_executor

from context import get_resolver, resolve_message, update_context
from proactive import get_proactive_engine, check_proactive
from task_queue import get_task_queue
from conversation import get_conversation_manager, detect_emotion, build_messages

PIPER_VOICE_PATH = os.getenv('PIPER_VOICE', '')

# Remote access: VERTHA_HOST=0.0.0.0 to listen beyond this machine, and
# VERTHA_CORS_ORIGINS=http://my-laptop:5173,... for the page's origin(s).
BIND_HOST = os.getenv('VERTHA_HOST', '127.0.0.1')
CORS_ORIGINS = [o.strip() for o in os.getenv('VERTHA_CORS_ORIGINS', '').split(',') if o.strip()]
PIPER_VOICE_DIR = os.getenv('PIPER_VOICE_DIR', str(Path(__file__).parent))

LOG_DIR = Path(__file__).parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

logger = logging.getLogger('vertha-tts')
logger.setLevel(logging.DEBUG)
fmt = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')

fh = logging.FileHandler(LOG_DIR / 'server.log')
fh.setLevel(logging.DEBUG)
fh.setFormatter(fmt)

ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)
ch.setFormatter(fmt)

logger.addHandler(fh)
logger.addHandler(ch)

voice = None


# Voice out. TTS_ENGINE picks it: 'piper' (local, needs PIPER_VOICE), 'groq' (hosted, needs GROQ_API_KEY).
# Unset: Piper if its voice file loads, otherwise Groq if the key is set, otherwise text only.
TTS_ENGINE = (os.getenv('TTS_ENGINE') or '').strip().lower()
GROQ_API_KEY = (os.getenv('GROQ_API_KEY') or '').strip()
GROQ_SPEECH_URL = 'https://api.groq.com/openai/v1/audio/speech'
GROQ_TTS_MODEL = os.getenv('GROQ_TTS_MODEL', 'canopylabs/orpheus-v1-english')
GROQ_TTS_VOICE = os.getenv('GROQ_TTS_VOICE', 'troy')


def voice_engine() -> str:
    """'piper', 'groq', or '' for text only."""
    if TTS_ENGINE == 'groq':
        return 'groq' if GROQ_API_KEY else ''
    if TTS_ENGINE == 'piper':
        return 'piper' if voice else ''
    if voice:
        return 'piper'
    if GROQ_API_KEY:
        return 'groq'
    return ''


def load_voice():
    global voice
    if not PIPER_VOICE_PATH:
        logger.error('PIPER_VOICE not configured — set PIPER_VOICE in src/tts/.env.local')
        return False
    voice_path = Path(PIPER_VOICE_PATH)
    if not voice_path.exists():
        logger.error(f'Piper voice not found at: {voice_path}')
        return False
    try:
        import piper
        voice = piper.PiperVoice.load(str(voice_path))
        logger.info(f'Loaded Piper voice: {voice_path}')
        return True
    except Exception as e:
        logger.error(f'Failed to load Piper voice: {e}')
        return False


def synthesize_to_wav(text: str) -> tuple[bytes, int, int, int]:
    audio_chunks = list(voice.synthesize(text))
    if not audio_chunks:
        return b'', 22050, 2, 1

    first = audio_chunks[0]
    sample_rate = first.sample_rate
    sample_width = first.sample_width
    channels = first.sample_channels

    all_bytes = b''.join(chunk.audio_int16_bytes for chunk in audio_chunks)
    return all_bytes, sample_rate, sample_width, channels


def make_wav_bytes(audio_bytes: bytes, sample_rate: int, sample_width: int, channels: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setsampwidth(sample_width)
        w.setnchannels(channels)
        w.setframerate(sample_rate)
        w.writeframes(audio_bytes)
    return buf.getvalue()


MAX_CHUNK_CHARS = 200


def split_text(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []

    sentence_ends = re.compile(r'(?<=[.!?])\s+')
    parts = sentence_ends.split(text)

    chunks = []
    current = ''

    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(current) + len(part) + 1 <= MAX_CHUNK_CHARS:
            current = (current + ' ' + part).strip() if current else part
        else:
            if current:
                chunks.append(current)
            if len(part) <= MAX_CHUNK_CHARS:
                current = part
            else:
                words = part.split()
                current = ''
                for word in words:
                    if not current:
                        current = word
                    elif len(current) + len(word) + 1 <= MAX_CHUNK_CHARS:
                        current += ' ' + word
                    else:
                        chunks.append(current)
                        current = word
                if current:
                    chunks.append(current)
                current = ''

    if current:
        chunks.append(current)

    return [c for c in chunks if c.strip()]


@asynccontextmanager
async def lifespan(app):
    if load_voice():
        logger.info('Piper TTS server ready')
    else:
        logger.error('Piper TTS server starting WITHOUT a voice model — check PIPER_VOICE path')
    try:
        await memory_db.init_db()
        memory_embeddings.get_model()
        set_session_id(current_session_id)
        logger.info(f'Memory system initialized, session_id={current_session_id}')
    except Exception as e:
        logger.error(f'Memory system failed to initialize: {e}')

    from memory.db import get_active_task
    active_task = await get_active_task()
    if active_task:
        logger.info(f'Resuming incomplete task: {active_task["id"]}')

    logger.info('Task engine initialized')

    reminder_task = asyncio.create_task(
        run_reminder_checker(
            get_ws_manager().broadcast,
            lambda: get_ws_manager().connection_count > 0,
        )
    )

    yield
    reminder_task.cancel()
    sid = get_session_id()
    if sid:
        await memory_db.update_session_summary(sid, '[session ended]')
    logger.info('TTS server shutting down')


app = FastAPI(title='Vertha TTS (Piper)', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex='https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?',
    allow_origins=CORS_ORIGINS,
    allow_methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['*'],
)

app.include_router(weather_router)
app.include_router(spotify_router)
app.include_router(memory_router)
app.include_router(search_router)
app.include_router(pc_router)
app.include_router(reminders_router)


@app.get('/health')
async def health():
    engine = voice_engine()
    return {
        'status': 'ready' if engine else 'no_voice',
        'engine': engine or 'text',
        'voice': bool(engine),
        'voice_file': PIPER_VOICE_PATH,
    }


class SpeakRequest(BaseModel):
    text: str


def _join_wavs(parts: list[bytes], gap_seconds: float = 0.4) -> bytes:
    """Join WAV parts into one WAV with a short pause between them."""
    if len(parts) == 1:
        return parts[0]
    readers = [wave.open(io.BytesIO(p), 'rb') for p in parts]
    try:
        first = readers[0]
        sample_rate, sample_width, channels = first.getframerate(), first.getsampwidth(), first.getnchannels()
        silence = b'\x00' * (int(sample_rate * gap_seconds) * sample_width * channels)
        out = io.BytesIO()
        with wave.open(out, 'wb') as w:
            w.setsampwidth(sample_width)
            w.setnchannels(channels)
            w.setframerate(sample_rate)
            for i, r in enumerate(readers):
                w.writeframes(r.readframes(r.getnframes()))
                if i < len(readers) - 1:
                    w.writeframes(silence)
        return out.getvalue()
    finally:
        for r in readers:
            r.close()


def _piper_wav(chunks: list[str]) -> bytes:
    parts = []
    for i, chunk in enumerate(chunks):
        logger.info(f'  piper chunk {i+1}/{len(chunks)}: {len(chunk)} chars')
        audio_bytes, sr, sw, ch = synthesize_to_wav(chunk)
        parts.append(make_wav_bytes(audio_bytes, sr, sw, ch))
    return _join_wavs(parts)


async def _groq_wav(chunks: list[str]) -> bytes:
    """Groq's hosted speech (env-chosen model and voice). Input is capped per request, so chunks go one by one."""
    parts = []
    headers = {'Authorization': f'Bearer {GROQ_API_KEY}'}
    async with httpx.AsyncClient(timeout=60) as client:
        for i, chunk in enumerate(chunks):
            logger.info(f'  groq voice chunk {i+1}/{len(chunks)}: {len(chunk)} chars')
            response = await client.post(
                GROQ_SPEECH_URL,
                json={'model': GROQ_TTS_MODEL, 'voice': GROQ_TTS_VOICE, 'input': chunk, 'response_format': 'wav'},
                headers=headers,
            )
            if response.status_code in (401, 403):
                raise RuntimeError('Groq rejected GROQ_API_KEY for voice out')
            if response.status_code >= 400:
                raise RuntimeError(f'Groq voice answered {response.status_code}')
            parts.append(response.content)
    return _join_wavs(parts)


@app.post('/speak')
async def speak(req: SpeakRequest):
    text = req.text.strip()
    if not text:
        return Response(content=b'', media_type='audio/wav')

    engine = voice_engine()
    if not engine:
        return JSONResponse(
            {'error': 'Voice out is off: no voice is set. Set PIPER_VOICE to a Piper voice file, '
                      'or TTS_ENGINE=groq with GROQ_API_KEY, in src/tts/.env.local and restart. '
                      'Answers show as text until then.', 'voice': False},
            status_code=503,
        )

    logger.info(f'/speak ({engine}): {len(text)} chars')
    try:
        chunks = split_text(text)
        logger.info(f'Split into {len(chunks)} chunk(s)')
        if engine == 'groq':
            wav = await _groq_wav(chunks)
        else:
            wav = _piper_wav(chunks)
        logger.info(f'Synthesized {len(wav)} bytes')
        return Response(content=wav, media_type='audio/wav')
    except RuntimeError as e:
        logger.error(f'Voice out ({engine}) failed: {e}')
        return JSONResponse({'error': str(e)}, status_code=502)
    except Exception as e:
        logger.error(f'Synthesis error: {e}')
        import traceback
        traceback.print_exc()
        return JSONResponse({'error': str(e)}, status_code=500)


class ContextResolveRequest(BaseModel):
    message: str
    history: list[dict] = []


class ConversationBuildRequest(BaseModel):
    history: list[dict]
    new_message: str
    memory_context: str = ""


class TaskExecuteRequest(BaseModel):
    tool_calls: list[dict]
    session_id: str = ""


class EmotionRequest(BaseModel):
    message: str


@app.post('/context/resolve')
async def resolve_context(req: ContextResolveRequest):
    resolved = resolve_message(req.message, req.history)
    return {'resolved_message': resolved}


@app.get('/proactive/check')
async def proactive_check():
    context = {}
    suggestion = await check_proactive(context)
    return {'suggestion': suggestion}


@app.post('/conversation/emotion')
async def get_emotion(req: EmotionRequest):
    emotion = detect_emotion(req.message)
    return {'emotion': emotion}


@app.post('/conversation/build')
async def build_conversation_messages(req: ConversationBuildRequest):
    resolver = get_resolver()
    resolved = resolver.resolve(req.new_message, req.history)
    conv_manager = get_conversation_manager()
    emotion = detect_emotion(req.new_message)
    conv_manager.set_emotion(emotion)
    messages = conv_manager.build_messages(
        req.history, req.new_message, req.memory_context, resolved, emotion
    )
    return {'messages': messages, 'emotion': emotion}


@app.post('/tasks/execute')
async def execute_tasks(req: TaskExecuteRequest):
    task_queue = get_task_queue()
    tool_calls = req.tool_calls

    async def generate_sse():
        for i, tool_call in enumerate(tool_calls):
            step = i + 1
            remaining = len(tool_calls) - step
            tool_name = tool_call.get('name', 'unknown')
            narration = task_queue._get_narration(tool_name, remaining)
            data = {
                'step': step,
                'tool': tool_name,
                'status': 'done',
                'narration': narration,
                'remaining': remaining
            }
            yield f"data: {json.dumps(data)}\n\n"
        yield f"data: {json.dumps({'event': 'complete'})}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


class TaskStartRequest(BaseModel):
    plan: dict
    execute_immediately: bool = True


class StreamLLMRequest(BaseModel):
    messages: list[dict]
    model: str = "big-pickle"


@app.post('/tasks/start')
async def start_task(req: TaskStartRequest):
    plan = req.plan
    task_engine = get_task_engine()
    ws_manager = get_ws_manager()

    async def generate_sse():
        import json
        steps = plan.get("steps", [])
        task_id = plan.get("task_id", "unknown")
        tool_executor = get_tool_executor()

        for step_data in steps:
            n = step_data.get("n")
            tool_name = step_data.get("tool", "bash_exec")
            tool_input = step_data.get("input", {})
            label = step_data.get("label", f"Step {n}")

            data = {
                "event": "step_start",
                "step": n,
                "tool": tool_name,
                "label": label,
                "remaining": len(steps) - n
            }
            yield f"data: {json.dumps(data)}\n\n"
            await ws_manager.broadcast({"type": "task_update", "kind": "step_start", **data})

            if req.execute_immediately and tool_name in ("bash_exec", "file_read", "file_write", "file_delete", "file_list", "file_exists"):
                result = await tool_executor.execute(tool_name, tool_input)
                status = "done" if result.get("success") else "error"
                result_str = str(result.get("stdout") or result.get("error") or "")[:200]
                data = {
                    "event": "step_update",
                    "step": n,
                    "tool": tool_name,
                    "status": status,
                    "result": result_str,
                    "remaining": len(steps) - n
                }
                yield f"data: {json.dumps(data)}\n\n"
                await ws_manager.broadcast({"type": "task_update", "kind": "step_update", **data})
            else:
                data = {
                    "event": "step_update",
                    "step": n,
                    "tool": tool_name,
                    "status": "done",
                    "result": "Simulated execution",
                    "remaining": len(steps) - n
                }
                yield f"data: {json.dumps(data)}\n\n"
                await ws_manager.broadcast({"type": "task_update", "kind": "step_update", **data})

        data = {"event": "complete", "task_id": task_id}
        yield f"data: {json.dumps(data)}\n\n"
        await ws_manager.broadcast({"type": "task_complete", "task_id": task_id})

    return StreamingResponse(
        generate_sse(),
        media_type='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


@app.post('/tasks/abort')
async def abort_task():
    engine = get_task_engine()
    engine.abort()
    return {"success": True, "message": "Task abort requested"}


@app.get('/tasks/current')
async def get_current_task():
    engine = get_task_engine()
    current = engine.get_current()
    if current:
        return {"active": True, "task": current}
    return {"active": False, "task": None}


@app.get('/tasks/history')
async def get_task_history(limit: int = 10):
    engine = get_task_engine()
    history = engine.history[-limit:]
    return {"tasks": [t.to_dict() for t in history]}


@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    client_id = websocket.query_params.get("client_id", "default")
    ws_manager = get_ws_manager()

    await websocket.accept()
    await ws_manager.connect(websocket, client_id)
    logger.info(f"WebSocket connected: {client_id}")

    try:
        while True:
            data = await websocket.receive_text()
            await ws_manager.handle_incoming(data, client_id)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await ws_manager.disconnect(websocket, client_id)


@app.websocket('/ws/broadcast')
async def websocket_broadcast(websocket: WebSocket):
    await websocket.accept()
    client_id = "broadcast"
    ws_manager = get_ws_manager()
    await ws_manager.connect(websocket, client_id)

    try:
        while True:
            data = await websocket.receive_text()
            await ws_manager.handle_incoming(data, client_id)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")
    finally:
        await ws_manager.disconnect(websocket, client_id)


async def ws_broadcast_task_update(event_type: str, data: dict):
    ws_manager = get_ws_manager()
    await ws_manager.broadcast({
        "type": event_type,
        "data": data,
    })


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host=BIND_HOST, port=args.port, log_level='info')