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
| **Wake word** | "Hey Vertha" — speaker verification, no false triggers |
| **Voice in** | Groq Whisper — fast, accurate transcription |
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

Put these in the git-ignored `.env.local` files (or your shell), then restart the servers. Never prefix a key with `VITE_`: those values are shipped to the browser.

| Variable | Where | What it does |
|---|---|---|
| `GROQ_API_KEY` | `src/stt/.env.local` and `src/tts/.env.local` | Speech in (Groq hosted Whisper), and speech out if you use Groq for voice. |
| `GROQ_MODEL` | `src/stt/.env.local` | Speech model. Default `whisper-large-v3` (the most accurate); `whisper-large-v3-turbo` is faster. |
| `OPENAI_API_KEY` | `src/stt/.env.local` | Second speech engine, used only when Groq is not set or fails. |
| `OPENAI_STT_MODEL` | `src/stt/.env.local` | Default `whisper-1`. |
| `STT_LANGUAGE` | `src/stt/.env.local` | Empty (default) auto-detects, and Turkish and English both work. Set `en` or `tr` to pin one. |
| `STT_PROMPT` | `src/stt/.env.local` | Optional words the speech should expect, such as names. |
| `ZEN_API_KEY` | `.env.local` at the project root, and `src/tts/.env.local` for memory search | The key for AI answers. The dev server attaches it, so the browser never sees it. Without it the page says the AI answers need the Zen key. |
| `PIPER_VOICE` | `src/tts/.env.local` | Full path to a Piper voice file (`.onnx`, with its `.onnx.json` beside it). Install with `pip install piper-tts`. |
| `TTS_ENGINE` | `src/tts/.env.local` | `piper` or `groq` to force one. Unset: Piper if `PIPER_VOICE` loads, otherwise Groq if `GROQ_API_KEY` is set, otherwise text only. |
| `GROQ_TTS_MODEL`, `GROQ_TTS_VOICE` | `src/tts/.env.local` | Groq speech out. Defaults `canopylabs/orpheus-v1-english` and `troy`. Groq takes 200 characters per request; the server splits longer answers. |
| `WAKEWORD_ENABLED=1` | `src/stt/.env.local` | Optional wake-word model ("Hey Vertha"). Needs the wake-word packages and `SPEAKER_ENROLLMENT_PATH`. |
| `WAKE_KEYWORD=on` | `src/stt/.env.local` | Keyword wake. Listens for `WAKE_PHRASE` (default `jarvis`) in the transcript. Off unless set. |
| `WAKE_PHRASE` | `src/stt/.env.local` | The phrase, default `jarvis`. |

**Engine order.** Speech in tries Groq Whisper first, then OpenAI Whisper if its key is set, and the browser's built-in speech recognition last, only when the server holds no speech key at all. The orb shows which engine is active ("Speech in: Groq Whisper"). Browser recognition sends its audio to the browser's own speech service.

**Keyword wake and what it costs.** Keyword wake keeps the microphone open and sends a short window of audio to the speech engine about every three seconds, then looks for the phrase in the transcript. So it needs the speech engine running and a key set, and it uses the speech provider's requests all day. Only a match leaves the server; the words of a window that did not match are dropped. It is off by default: set `WAKE_KEYWORD=on` to turn it on, and turn it off again if you do not want an open microphone. Say "jarvis what's the weather" and the rest of the sentence is taken as the command.

What to expect:

- **Push-to-talk (default).** Click the orb, speak, and it stops when you pause. The orb says "Click to speak". Nothing listens in the background.
- **Keyword wake** (`WAKE_KEYWORD=on`) and **wake-word model** (`WAKEWORD_ENABLED=1`) keep listening. The orb says which phrase to use.
- **Speech in** needs a speech key. Without one, the browser's speech recognition answers, and the orb says "Speech in: browser speech". A key that is rejected shows its reason on screen.
- **Voice out** needs `PIPER_VOICE` or a Groq key. Without either, answers show as text and the orb says "Text only: voice out is not set up".
- **AI answers** need `ZEN_API_KEY`. Without it the page says so; the settings field still works if you typed a key there.
- **Memory search** needs `chromadb` and `sentence-transformers` (large packages). Without them, memory search is off; the rest still works.
- Every key is optional on its own. Set the ones you have, restart, and the page tells you what is still missing.

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
