# API Reference

Complete endpoint documentation for all Vertha services.

## STT Server (Port 8765)

### `GET /health`

Health check.

**Response:**
```json
{"status": "ready", "model": "whisper-large-v3-turbo"}
```

---

### `POST /wakeword`

Detect wake word from audio stream.

**Request:** Raw audio bytes (16-bit PCM, 16kHz mono)

**Response:**
```json
{"detected": true, "models": ["vertha"]}
```

---

### `POST /transcribe`

Transcribe audio to text.

**Request:** `multipart/form-data` with audio file

**Response:**
```json
{"text": "what's the weather like"}
```

**Validation:**
- Minimum audio size: 5000 bytes
- Minimum duration: 1000ms
- Formats: WAV, WebM/Opus

**Groq params:** `model=whisper-large-v3-turbo`, `language=en`, `temperature=0.2`

---

## TTS Server (Port 8766)

### `GET /health`

Health check.

**Response:**
```json
{"status": "ready", "engine": "piper", "voice": "en_US-lessac-medium"}
```

---

### `POST /speak`

Synthesize text to speech.

**Request:**
```json
{"text": "The weather in Istanbul is 22 degrees."}
```

**Response:** Raw WAV audio (`audio/wav`)

**Notes:**
- Text split at sentence boundaries (max 200 chars/chunk)
- 0.4s silence between chunks
- Output: 22050 Hz, 16-bit mono

---

### `POST /context/resolve`

Resolve ambiguous pronouns ("it", "that", "this") using conversation context.

**Request:**
```json
{
  "message": "play it",
  "history": [
    {"role": "user", "content": "play some music"},
    {"role": "assistant", "content": "playing your playlist"}
  ]
}
```

**Response:**
```json
{"resolved_message": "play it (context: spotify)"}
```

---

### `POST /conversation/emotion`

Detect user emotion from message.

**Request:**
```json
{"message": "this is so frustrating"}
```

**Response:**
```json
{"emotion": "frustrated"}
```

---

### `POST /conversation/build`

Build conversation messages with emotion and memory context.

**Request:**
```json
{
  "history": [],
  "new_message": "what's the weather",
  "memory_context": "You live in Istanbul."
}
```

**Response:**
```json
{
  "messages": [...],
  "emotion": "neutral"
}
```

---

### `POST /tasks/execute`

Execute multi-step task with SSE narration.

**Request:**
```json
{
  "tool_calls": [
    {"name": "weather", "input": {"city": "Istanbul"}},
    {"name": "spotify_play", "input": {"uri": "spotify:..."}}
  ],
  "session_id": "abc-123"
}
```

**Response:** Server-Sent Events stream

```
data: {"step": 1, "tool": "weather", "status": "done", "narration": "Weather retrieved. Now...", "remaining": 1}

data: {"event": "complete"}
```

---

### `GET /proactive/check`

Check if proactive suggestions should trigger.

**Response:**
```json
{"suggestion": "Good morning, sir. Say 'good morning' for your briefing."}
```

or

```json
{"suggestion": null}
```

---

## Weather (`/weather`)

### `GET /weather`

Get current weather and forecast.

**Query params:** `lat=41.0`, `lon=28.9`

**Response:**
```json
{
  "current_temp": 22,
  "condition": "partly cloudy",
  "high": 25,
  "low": 18,
  "rain_chance": 20,
  "humidity": 65.0
}
```

---

## Spotify (`/spotify`)

### `GET /spotify/auth`

Get OAuth authorization URL.

**Response:**
```json
{"auth_url": "https://accounts.spotify.com/authorize?..."}
```

### `GET /spotify/callback`

OAuth callback. Exchange code for tokens.

**Query params:** `code=abc123`

**Response:**
```json
{"status": "authenticated"}
```

### `GET /spotify/status`

Get current playback status.

**Response:**
```json
{"playing": true, "message": "Now playing: Album - Artist"}
```

### `PUT /spotify/play`

Start playback.

**Request:**
```json
{"context_uri": "spotify:album:xxx"}
```

**Response:**
```json
{"status": "playing"}
```

### `PUT /spotify/pause`

Pause playback.

**Response:**
```json
{"status": "paused"}
```

### `POST /spotify/volume`

Set volume.

**Query params:** `volume=50` (0-100)

**Response:**
```json
{"volume": 50}
```

### `POST /spotify/sleep-timer/start`

Start sleep timer.

**Query params:** `duration_minutes=30` (default: 45)

**Response:**
```json
{"status": "started", "duration_minutes": 30}
```

### `POST /spotify/sleep-timer/cancel`

Cancel sleep timer.

**Response:**
```json
{"status": "cancelled"}
```

---

## PC Control (`/pc`)

### `GET /pc/health`

Check PC control availability.

**Response:**
```json
{
  "pc_control_enabled": true,
  "dangerous_tier_enabled": false,
  "tools_installed": {"xdotool": true, "wmctrl": true},
  "ready": true
}
```

### `GET /pc/windows`

List open windows.

**Response:**
```json
{"result": "Firefox - Vertha - Mozilla Firefox\nTerminal - vertha\nCode - src/App.jsx - Visual Studio Code"}
```

### `POST /pc/execute`

Execute a PC control tool.

**Request:**
```json
{
  "tool": "open_app",
  "input": {"name": "firefox"},
  "session_id": "abc-123",
  "dangerous_tier": false
}
```

**Response (allowed):**
```json
{"allowed": true, "result": "opened firefox"}
```

**Response (needs confirmation):**
```json
{
  "requires_confirmation": true,
  "confirm_id": "xyz-789",
  "tier": "moderate",
  "message": "Type text: 'hello world'?"
}
```

### `POST /pc/confirm/{confirm_id}`

Confirm a pending action.

**Response:**
```json
{"success": true, "result": "text typed"}
```

### `DELETE /pc/confirm/{confirm_id}`

Cancel a pending action.

**Response:**
```json
{"cancelled": true, "tool": "type_text"}
```

---

## Memory (`/memory`)

### `GET /memory/health`

Check memory system health.

**Response:**
```json
{
  "status": "ready",
  "session_id": "abc-123",
  "model": "all-MiniLM-L6-v2"
}
```

### `POST /memory/search`

Search conversation history.

**Request:**
```json
{"query": "what did I say about python", "limit": 5}
```

**Response:**
```json
{
  "conversations": {"documents": ["I was talking about python earlier..."]},
  "pinned": [...]
}
```

### `POST /memory/pin`

Pin a memory manually.

**Request:**
```json
{"content": "My printer is in the office", "source": "user"}
```

**Response:**
```json
{"id": 1, "content": "My printer is in the office"}
```

### `GET /memory/pinned`

Get all pinned memories.

**Response:**
```json
[
  {"id": 1, "content": "My printer is in the office", "source": "user", "created_at": "..."}
]
```

### `DELETE /memory/pinned/{id}`

Delete a pinned memory.

**Response:**
```json
{"status": "deleted"}
```

### `POST /memory/message`

Add a message to conversation history.

**Request:**
```json
{"role": "user", "content": "remember that my birthday is march 15th"}
```

**Response:**
```json
{"status": "saved", "embedding_id": "abc-123"}
```

**Auto-pin:** Messages matching patterns like "remember that" are automatically pinned.

### `GET /memory/context`

Get pinned memories for LLM context.

**Response:**
```json
{"context": [...]}
```

---

## Search (`/search`)

### `POST /search`

Basic web search via DuckDuckGo.

**Request:**
```json
{"question": "who is the president of france"}
```

**Response:**
```json
{
  "results": [
    {"title": "...", "url": "...", "snippet": "..."}
  ]
}
```

### `POST /search/intelligent`

Web search with LLM synthesis.

**Request:**
```json
{"question": "what is the capital of japan"}
```

**Response:**
```json
{
  "answer": "Sir, the capital of Japan is Tokyo.",
  "sources": ["https://en.wikipedia.org/wiki/Tokyo"]
}
```

**Process:**
1. DuckDuckGo search
2. Fetch top 3 pages (skip paywalled sites)
3. LLM synthesizes 2-4 sentence answer starting with "Sir"
4. 5-minute cache
