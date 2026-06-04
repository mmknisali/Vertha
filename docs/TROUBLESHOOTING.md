# Troubleshooting

## Services Not Starting

### STT Server Fails

**Error:** `ModuleNotFoundError: No module named 'speechbrain'`

**Fix:**
```bash
.venv/bin/pip install speechbrain
```

**Error:** `libstdc++.so.6: cannot find`

On NixOS, set `STD6_PATH`:
```bash
STD6_PATH=/nix/store/...-gcc-15.2.0-lib/lib/libstdc++.so.6 \
  .venv/bin/uvicorn server:app --host 0.0.0.0 --port 8765
```

---

### TTS Server Fails

**Error:** `onnxruntime.backend.backend.NotImplementedError`

**Fix:** Re-download the Piper voice model:
```bash
.venv/bin/python -c "from piper import PiperVoice; PiperVoice.download_voices('.')"
```

**Error:** `port already in use`

Another process is using port 8766:
```bash
lsof -i :8766 | grep LISTEN
kill <PID>
```

---

### Frontend Won't Start

**Error:** `Cannot find module './src/main.jsx'`

**Fix:**
```bash
npm install
```

---

## Voice Recognition Issues

### Wake Word Not Detecting

1. **Check microphone:** Ensure the correct input device is selected in system settings.

2. **Enroll your voice:** The default enrollment is for a specific voice. Re-enroll yours in Settings (default phrase: "Hey Vertha").

3. **Speak closer:** Try speaking 6-12 inches from the microphone.

4. **Check noise:** High background noise can interfere. Try a quieter environment.

### Wake Word Triggers Too Easily

1. Re-enroll in a quiet environment
2. Lower your voice slightly when speaking
3. Increase the similarity threshold in `src/stt/wakeword.py` (default: 0.15, try 0.20)

### Transcription Cuts Off

**Silence detection too aggressive:**
- Increase `SILENCE_MS` in `useSTT.js` (default: 3500)
- Or speak more continuously

**Recording stops too soon:**
- Increase `MIN_UTTERANCE_MS` (default: 1500)

---

## Audio Issues

### No Audio Output

1. **Browser autoplay blocked:** Click somewhere on the page first.

2. **Check AudioContext state:** Open browser console, run:
   ```js
   audioCtx = new AudioContext()
   audioCtx.state // should be "running"
   ```

3. **Check system volume:** Ensure not muted and volume is up.

---

### TTS Echo / False Triggers

When Vertha speaks, the mic picks it up and triggers listening again.

**This is expected behavior.** The code guards against this by checking `status !== 'speaking'` before processing wake word. If you're still seeing this:

1. Lower the speaker volume
2. Speak closer to the mic (so your voice is louder than the speaker output)
3. Use headphones

---

## Memory Problems

### Memories Not Being Found

**Search threshold too high:** Try lowering `VERTHA_MEMORY_SIMILARITY_THRESHOLD` (default: 0.35).

Lower = stricter matching:
- 0.2: Very similar only
- 0.35: Balanced
- 0.5: More lenient

### Auto-Pin Not Working

Check that the message contains keywords: "remember that", "don't forget", "keep in mind", "always remember", "note that".

---

## Spotify Issues

### Authentication Fails

1. Ensure `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are set in `src/tts/.env.local`
2. Check redirect URI in Spotify dev dashboard matches `http://127.0.0.1:8766`
3. Delete `.tokens.json` and re-authenticate at `/spotify/auth`

### Playback Not Working

- Requires Spotify Premium
- A device must be active with Spotify open
- The play endpoint requires a context URI, not a song name

---

## PC Control Issues

### Tools Not Installed

**Error:** `Tool xdotool not found`

**Fix (Ubuntu/Debian):**
```bash
sudo apt install xdotool wmctrl x11-utils
```

**Fix (Fedora):**
```bash
sudo dnf install xdotool wmctrl xdpyinfo
```

### Confirmation Not Appearing

The frontend must be connected to receive the confirmation request. If the TTS server is running headless, PC control confirmations won't reach the user.

---

## Performance

### High CPU Usage

- Wake word detection runs continuously — some CPU usage is normal
- If >20% CPU when idle, check for audio feedback loops

### Slow Transcription

- Groq Whisper is fast (<2s typically)
- If slow, check network latency to Groq API
- Or consider running a local Whisper model

---

## Known Issues

See [ISSUES.md](https://github.com/mmknisali/vertha/blob/main/ISSUES.md) for the full issue tracker.
