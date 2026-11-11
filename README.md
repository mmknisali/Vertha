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
