# Vertha

A voice assistant that lives in your browser. Wakes on "Hey Vertha", speaks the weather, controls your desktop, and remembers things you tell it.

Built with local speech-to-text, local TTS synthesis, and cloud AI for reasoning.

---

## Quick Start

```bash
devenv up
```

Open `http://localhost:5173` in your browser.

---

## What It Does

| Feature | How |
|---------|-----|
| **Push to talk** | Click the button and speak. Optional wake phrase or wake-word model, off by default |
| **Voice in** | Groq Whisper (OpenAI Whisper as second engine) |
| **Voice out** | Piper TTS — neural voice, runs locally |
| **Memory** | Vector search across your conversations |
| **Weather** | Open-Meteo — free, no API key |
| **Spotify** | Play, pause, volume, sleep timer |
| **Desktop** | Window management, typing, screenshots |
| **Web search** | DuckDuckGo + LLM synthesis |

## Running on a server and opening it from a laptop

The two Python servers and the front end can run on a machine you reach over the network.

1. On the server, set the bind host and the page origin in `src/tts/.env.local` and `src/stt/.env.local` (or in the environment):
   ```bash
   VERTHA_HOST=0.0.0.0                                # listen beyond the server itself
   VERTHA_CORS_ORIGINS=http://your-server:5173        # the origin the page is opened from
   ```
2. Start the front end on all interfaces: `VERTHA_DEV_HOST=0.0.0.0 npm run dev`.
3. On the laptop, open `http://your-server:5173`. The page finds the speech servers on the same host (ports 8765 and 8766). To point it elsewhere, set `VITE_TTS_URL` / `VITE_STT_URL` (or `VITE_TTS_PORT` / `VITE_STT_PORT`) before the build or dev start.

Local use needs none of this: the defaults stay on `127.0.0.1` and `localhost`.

**There is no login.** Anyone who can reach the ports can talk to the assistant, run the tools and control the desktop. Put it behind a private network, a VPN, or an authenticating proxy, and do not expose these ports to the internet as they are. Adding a token is the next step, and it is yours to set.

**Keys you add yourself** (never in the repo): `GROQ_API_KEY` (speech in), the Zen key used for the AI answers, and optionally the Spotify client ID and secret. Keep them in `.env.local` files on the server; those files are git-ignored.

## Voice setup on your server

Three things run: the front end (port 5173), the speech server (port 8765) and the voice server (port 8766). You need Node 18+ and Python 3.10+.

**1. Keys.** Never commit them, and never prefix a key with `VITE_` (that ships it to the browser). Put each one in the file shown, then restart the server that reads it:

- `.env.local` in the project root: `ZEN_API_KEY=...`. For AI answers. The dev server attaches it, so the browser never sees it.
- `src/stt/.env.local`: `GROQ_API_KEY=...`. For speech in. Optional: `OPENAI_API_KEY` (second engine), `GROQ_MODEL`, `STT_LANGUAGE`, `STT_PROMPT`.
- `src/tts/.env.local`: either `PIPER_VOICE=/full/path/to/voice.onnx` (voice out, local) or `TTS_ENGINE=groq` with `GROQ_API_KEY=...` (voice out, hosted). Optional `ZEN_API_KEY` here, only for memory search.

**2. Speech server** (terminal 1, from the project root; the first two lines are once):

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install fastapi uvicorn httpx python-dotenv python-multipart
python src/stt/server.py --port 8765
```

Works when the log says `Speech in is on. Engines in order: groq`, and `curl http://localhost:8765/health` shows `"speech_in": true`. Without the key the log says `Speech in is off` and the page says so on screen.

**3. Voice server** (terminal 2, same venv; the install line is once):

```bash
pip install fastapi uvicorn httpx python-dotenv python-multipart aiosqlite duckduckgo-search piper-tts
python src/tts/server.py --port 8766
```

Works when `curl http://localhost:8766/health` answers. `"voice": true` with `"engine": "piper"` or `"groq"` means voice out is on. `"voice": false` means answers are text only, and the page says "Text only" under the orb. `piper-tts` is needed only for `PIPER_VOICE`. The log line `Memory system failed to initialize: Memory search is off` is expected unless you install `chromadb` and `sentence-transformers` (large packages, see `requirements.txt`); everything else still works without them.

**4. Front end** (terminal 3, from the project root; `npm install` is once):

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. From another machine, start it with `VERTHA_DEV_HOST=0.0.0.0 npm run dev` and set `VERTHA_HOST` and `VERTHA_CORS_ORIGINS` for both Python servers, as in "Running on a server" above. Restart `npm run dev` after changing the root `.env.local`: the dev server reads it only at start.

**What to test, in order**

1. Open the page. Under the orb, four status chips: `Speech in: Groq Whisper`, `Voice out: Piper` (or `Groq speech`, or `Text only`), the wake mode (`Push to talk only` by default), and `AI answers: ready`.
2. Click **PUSH TO TALK**, say one sentence, and pause. The button shows LISTENING, then TRANSCRIBING, then THINKING. The answer lands in the log and is spoken if voice out is on.
3. Type one message in the text box as well. That checks the AI answers without the microphone.

**What you see when something is missing**

| On screen | What to do |
|---|---|
| `Speech in needs GROQ_API_KEY` | Add the key to `src/stt/.env.local`, restart the speech server, click again. |
| `Speech in failed: Groq rejected GROQ_API_KEY` | The key is wrong or revoked. Replace it in `src/stt/.env.local`, restart the speech server. |
| `Can't reach the speech server` | Terminal 1 is not running, or it is on another port. Start it. |
| `AI answers need the Zen key` | Add `ZEN_API_KEY` to the root `.env.local`, restart `npm run dev`. |
| `Text only: voice out is not set up` | Expected without `PIPER_VOICE` or a Groq voice. Answers show as text. |
| `Speech in: not ready` | The speech server has not answered yet. Check terminal 1. |

Banners stay until you click **Dismiss**, or until the next try clears them.

**Wake word is off by default.** Push to talk needs nothing extra.

- `WAKE_KEYWORD=on` in `src/stt/.env.local` listens for `WAKE_PHRASE` (default `jarvis`). It sends a short audio window to Groq about every three seconds while it is on, so it keeps the microphone open and uses the speech provider all day. Only a match leaves the server. Say "jarvis what's the weather" and the rest is the command.
- `WAKEWORD_ENABLED=1` turns on the "Hey Vertha" model. It needs `torch`, `silero_vad`, `speechbrain`, and a speaker enrollment (`SPEAKER_ENROLLMENT_PATH`). Not verified in this pass.

**Speech in never falls back silently.** It uses Groq Whisper, then OpenAI Whisper if its key is set. If neither key is set, or the speech server is down, the page says so and nothing listens.


---

## Requirements

- Linux (X11)
- Nix with flakes (or Python 3.10+, Node 18+, manually)
- Microphone and speakers

See the [Setup Guide](docs/SETUP.md) for full installation.

---

## Documentation

- [Setup](docs/SETUP.md) — Installation and configuration
- [Architecture](docs/ARCHITECTURE.md) — How it works
- [Features](docs/FEATURES.md) — Everything it can do
- [API Reference](docs/API.md) — Backend endpoints
- [Development](docs/DEVELOPMENT.md) — Working on the codebase
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Solving problems

---

## Project Info

[Repository](https://github.com/mmknisali/vertha) | [Issues](https://github.com/mmknisali/vertha/issues)
