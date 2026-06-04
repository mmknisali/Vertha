# Development

## Running Services

### All Services (Devenv)

```bash
devenv up
```

### Individual Services

**STT Server:**
```bash
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8765
```

**TTS Server:**
```bash
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8766
```

**Frontend:**
```bash
npm run dev
```

## Verifying Services

```bash
curl http://localhost:8765/health   # STT
curl http://localhost:8766/health   # TTS
```

## Frontend Commands

```bash
npm run dev       # Dev server (port 5173)
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

## Project Structure

```
src/
├── main.jsx                 # React entry point
├── App.jsx                  # Main app — state, AI orchestration
├── index.css                # Global styles
├── components/              # React UI components
│   ├── BackgroundLayers.jsx
│   ├── CenterPanel.jsx      # Orb and conversation
│   ├── LeftPanel.jsx        # System status, memory
│   ├── RightPanel.jsx       # Clock, weather, tasks
│   ├── Orb.jsx              # Canvas animation
│   └── SettingsDrawer.jsx
├── hooks/                   # Custom React hooks
│   ├── useSTT.js            # Speech-to-text
│   ├── useTTS.js            # Text-to-speech
│   └── useWakeWord.js       # Wake word detection
├── stt/                     # STT service (FastAPI)
│   ├── server.py
│   └── wakeword.py
└── tts/                     # TTS service (FastAPI)
    ├── server.py
    ├── weather.py
    ├── spotify.py
    ├── context.py
    ├── conversation.py
    ├── proactive.py
    ├── task_queue.py
    ├── pc_control.py
    ├── permissions.py
    ├── memory/
    │   ├── db.py
    │   ├── embeddings.py
    │   ├── router.py
    │   └── search.py
    └── routers/
        └── pc_control.py
```

## Key Constants

### STT (useSTT.js)

| Constant | Value | Purpose |
|----------|-------|---------|
| `SILENCE_MS` | 3500 | Silence before stopping |
| `MIN_UTTERANCE_MS` | 1500 | Minimum recording |
| `LISTENING_TIMEOUT_MS` | 20000 | Hard timeout |
| `VITE_SILENCE_THRESHOLD` | 10 | Volume threshold |

### TTS (useTTS.js)

| Constant | Value | Purpose |
|----------|-------|---------|
| `CHUNK_TIMEOUT` | 15000 | Per-chunk timeout |

### Memory (router.py)

| Constant | Default | Purpose |
|----------|---------|---------|
| `MAX_CONTEXT_MEMORIES` | 5 | Memories in context |
| `MEMORY_SIMILARITY_THRESHOLD` | 0.35 | Search threshold |

Lower threshold = stricter matching (more similar required).

## Browser Considerations

### AudioContext Suspension

Browsers suspend `AudioContext` until user gesture. `useTTS.js` and `useSTT.js` call `ctx.resume()` but it can silently fail.

**Symptoms:** Audio plays but nothing heard.

**Fix:** Click somewhere on the page first.

### TTS Echo

When Vertha speaks, the microphone may pick it up and trigger wake word.

**Guard:** `onWakeWord` and `onInterim` check `status !== 'speaking'` to prevent this.

## Wake Word Enrollment

1. Open Vertha in browser
2. Go to Settings
3. Click "Enroll Voice"
4. Say "Hey Vertha" 3-5 times clearly
5. Enrollment saves to `enrollments/vertha.pt`

The STT server loads this embedding at startup.
