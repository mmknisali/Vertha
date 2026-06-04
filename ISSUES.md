# Vertha Issues Tracker

## Open Issues

### 1. Spotify Endpoints — 204 Response Handling Bug

**Location:** `src/tts/spotify.py`

**Problem:** Spotify API returns HTTP 204 No Content for `PUT /me/player/volume` and `PUT /me/player/play`. The current `sp_put()` function does not handle 204 correctly — it attempts to call `resp.json()` on a 204 response which causes an exception → 500 Internal Server Error.

**Affected endpoints:**
- `POST /spotify/volume?volume=N` — always returns 500
- `PUT /spotify/play?episode_uri=URI` — always returns 500

**Current workaround:** None. Endpoints are non-functional.

**Required fix:**
```python
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
            return {'status': 'ok'}  # ← Must handle 204 explicitly
        resp.raise_for_status()
        return resp
```

---

### 2. Good Night Routine — Spotify Chain Broken

**Location:** `src/App.jsx` → `runNightRoutine()`

**Problem:** When "good night" is triggered, the Spotify chain fails because:
1. `POST /spotify/volume` returns 500 (issue #1)
2. `PUT /spotify/play` returns 500 (issue #1)

**Affected flow:**
```javascript
if (PODCAST_EPISODE_URI) {
  await Promise.all([
    fetch(`${TTS_URL}/spotify/volume?volume=${PODCAST_VOLUME}`, { method: 'POST' }),
    fetch(`${TTS_URL}/spotify/play?episode_uri=${encodeURIComponent(PODCAST_EPISODE_URI)}`, { method: 'PUT' }),
    fetch(`${TTS_URL}/sleep-timer/start?duration_minutes=45`, { method: 'POST' }),
  ]);
}
```

**Impact:** "Good night" routine only speaks the reply but does not control Spotify or start the sleep timer.

**Workaround:** Fix issue #1 to restore Spotify functionality.

---

### 3. Music Trigger — Spotify Not Working

**Location:** `src/App.jsx` → `runMusicRoutine()`

**Problem:** User can say "play music" (detected via fuzzy matching) but the Spotify `play` endpoint returns 500 due to issue #1.

**Affected flow:**
```javascript
const runMusicRoutine = async () => {
  // ...
  if (PODCAST_EPISODE_URI) {
    await Promise.all([
      fetch(`${TTS_URL}/spotify/volume?volume=${PODCAST_VOLUME}`, { method: 'POST' }),
      fetch(`${TTS_URL}/spotify/play?episode_uri=${encodeURIComponent(PODCAST_EPISODE_URI)}`, { method: 'PUT' }),
    ]);
  }
  // ...
};
```

**Impact:** "Play music" responds with TTS but doesn't actually play anything on Spotify.

**Workaround:** Fix issue #1.

---

### 4. Sleep Timer — Uses Episode URI Instead of Show URI

**Location:** `src/App.jsx` → `runNightRoutine()`

**Problem:** When playing a podcast via Spotify, the code uses `spotify:episode:7pK7xHDDFC3fmnatbwR8nu`. Spotify's playback API may prefer `context_uri` pointing to a show to get the latest episode automatically, rather than a specific episode URI.

**Current behavior:**
```javascript
json_data={'context_uri': 'spotify:episode:7pK7xHDDFC3fmnatbwR8nu'}
```

**Suggested improvement:** Use `spotify:show:XXXXXXXX` to let Spotify resolve to the latest episode automatically. Requires the show URI from the podcast.

**Impact:** Minor. The episode plays but may not auto-advance to newer episodes.

---

### 5. Spotify /status Endpoint Returns 401

**Location:** `src/tts/spotify.py` → `/spotify/status`

**Problem:** The status endpoint sometimes returns `{"error":{"status":401,"message":"Permissions missing"}}` even though the token appears valid.

**Likely cause:** The `.tokens.json` file stores `expires_at` in a format that may not be correctly compared in `get_access_token()`. The token may be considered expired when it's not.

**Current code:**
```python
if ACCESS_TOKEN and TOKEN_EXPIRES_AT > asyncio.get_event_loop().time() * 1000:
    return ACCESS_TOKEN
```

The `asyncio.get_event_loop().time()` returns seconds (float), while `TOKEN_EXPIRES_AT` is stored in milliseconds. The comparison may be incorrect depending on how the token was saved.

**Impact:** Status check unreliable, but not blocking — other endpoints work when token is fresh.

**Workaround:** Re-authenticate via `/spotify/auth` if status fails.

---

### 6. libstdc++.so.6 Missing — Piper TTS Unstable

**Location:** System library dependency

**Problem:** Occasionally Piper fails to load with:
```
libstdc++.so.6: cannot open shared object file: No such file or directory
```

**Likely cause:** numpy or piper native extensions can't find the system libstdc++. The error appeared in logs but the server later recovered and functioned normally.

**Impact:** Intermittent — TTS may fail to start but usually recovers.

**Workaround:** Restart the TTS server if Piper fails to load:
```bash
.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8766 --reload
```

---

### 7. useSTT.js Syntax Error (Fixed)

**Location:** `src/hooks/useSTT.js`

**Problem:** Duplicate `.catch()` block and malformed `} else {` structure caused the entire app to fail compilation with:
```
[plugin:vite:import-analysis] Failed to parse source for import analysis because the content contains invalid JS syntax
```

**Status:** ✅ Fixed — removed duplicate code block.

---

## Resolved Issues

| Issue | Status | Notes |
|-------|--------|-------|
| TTS reading markdown symbols (`**`, `*`, `–`) | ✅ Fixed | Added `cleanTextForSpeech()` in useTTS.js |
| Mid-sentence audio cutoffs | ✅ Fixed | Adaptive timeout based on text length |
| False "Audio playback failed" errors | ✅ Fixed | Removed misleading onErrorRef calls |
| Wake word not detecting mispronunciations | ✅ Fixed | Added Levenshtein-based fuzzy matching |
| Sentences cut off mid-speech | ✅ Fixed | SILENCE_MS 3500→6000, MIN_SPEECH_MS guard added, silence detection removed in listening mode |
| useSTT.js syntax error | ✅ Fixed | Removed duplicate catch block |
| Import order causing Spotify env vars empty | ✅ Fixed | Moved `load_dotenv()` before router imports |

---

## Known Limitations

1. **Spotify requires premium account** — User-modify-playback-state API only works with Spotify Premium
2. **Redirect URI requirement** — Spotify requires `http://127.0.0.1:PORT/callback` (not `localhost`)
3. **Weather location is Gaziantep** — Hardcoded defaults in `.env.local`:
   - `VITE_LOCATION_LAT=37.0662`
   - `VITE_LOCATION_LON=37.3833`

---

## Environment Variables Reference

### Root `.env.local`
```
VITE_TTS_URL=http://localhost:8766
VITE_STT_URL=http://localhost:8765
VITE_ZEN_API_KEY=...
GROQ_API_KEY=...
VITE_LOCATION_LAT=37.0662
VITE_LOCATION_LON=37.3833
VITE_PODCAST_EPISODE_URI=spotify:episode:7pK7xHDDFC3fmnatbwR8nu
VITE_PODCAST_VOLUME=75
```

### `src/tts/.env.local`
```
PIPER_VOICE=/home/ali/workspace/mmknisali/vertha/src/tts/voices/en_US-lessac-medium.onnx
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
PODCAST_EPISODE_URI=spotify:episode:7pK7xHDDFC3fmnatbwR8nu
PODCAST_VOLUME=75
```