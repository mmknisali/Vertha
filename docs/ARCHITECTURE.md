# Architecture

Vertha consists of three independent services that communicate over HTTP.

## Services

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| Frontend | 5173 | Vite + React | User interface, audio capture/playback |
| STT Server | 8765 | FastAPI + Groq | Speech-to-text transcription |
| TTS Server | 8766 | FastAPI + Piper | Text-to-speech, memory, tools |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│                                                                  │
│  Wake Word ──► Microphone ──► useSTT ──► STT Server (8765)     │
│                                    │                            │
│                                    ▼                            │
│                           Groq Whisper API                       │
│                                    │                            │
│  Orb Display ◄────────────────────┘                            │
│                                    │                            │
│  AI Response ◄────────────────────┤                            │
│     │                               │                            │
│     │                         Zen API                           │
│     │                      (via Vite proxy)                     │
│     │                               │                            │
│     ▼                               ▼                            │
│  useTTS ◄────────────────────── TTS Server (8766)               │
│     │                               │                            │
│     │                         Piper TTS                         │
│     ▼                               │                            │
│  Audio Playback ◄──────────────────┘                            │
│                                                                  │
│  Also connects to: Memory, Weather, Spotify, PC Control         │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend (Port 5173)

The React SPA handles:

- Microphone audio capture via `MediaRecorder` API
- Wake word detection via continuous audio monitoring
- Volume visualization (orb animation)
- Conversation history display
- Settings management (location, Spotify, PC control)

**Key hooks:**

- `useWakeWord.js` — Continuous listening for "Hey Jarvis"
- `useSTT.js` — Recording and silence detection after wake word
- `useTTS.js` — Audio playback queue with 15s timeout per chunk

**Audio constraints:** `echoCancellation: true, noiseSuppression: true, autoGainControl: true`

## STT Server (Port 8765)

Handles speech-to-text using Groq's Whisper API.

**Endpoints:**
- `POST /wakeword` — Speaker verification against enrolled voice
- `POST /transcribe` — Audio to text via Groq Whisper

**Wake word pipeline:**
1. Silero VAD detects speech in 512-sample windows
2. Audio buffered until speech ends
3. SpeechBrain ECAPA-TDNNB compares against enrolled speaker embedding
4. Cosine similarity above threshold = wake word detected

**Transcription:**
- Minimum audio: 5000 bytes, 1000ms duration
- Groq params: `language=en`, `temperature=0.2`
- Timeout: 30 seconds

## TTS Server (Port 8766)

Handles speech synthesis, memory, and system tools.

**Endpoints:**
- `POST /speak` — Synthesize text to audio
- `/memory/*` — Vector search, session management
- `/weather` — Open-Meteo proxy
- `/spotify/*` — Spotify playback control
- `/pc/*` — Window management, input, screenshots
- `/search` — DuckDuckGo + LLM synthesis

**TTS pipeline:**
1. Text split at sentence boundaries (max 200 chars per chunk)
2. Each chunk synthesized via Piper
3. Chunks concatenated with 0.4s silence gaps
4. WAV returned at 22050 Hz

## Memory System

**Storage:**
- ChromaDB for vector embeddings (`all-MiniLM-L6-v2`)
- SQLite for structured data
- Location: `~/.local/share/vertha/memory/`

**Collections:**
- `conversations` — embedded message history
- `pinned` — persistent memories

**Auto-pin:** Messages matching patterns like "remember that", "don't forget" are automatically pinned.

## PC Control

Three-tier permission system:

| Tier | Examples | Confirmation |
|------|----------|--------------|
| Safe | list windows, get system info | None |
| Moderate | type text, click, screenshot | Always |
| Dangerous | run commands, delete files | Always + global flag |

Tools use `xdotool`, `wmctrl`, `scrot`, `amixer`.
