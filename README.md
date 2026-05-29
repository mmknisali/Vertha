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
| **Wake word** | "Hey Jarvis" — speaker verification, no false triggers |
| **Voice in** | Groq Whisper — fast, accurate transcription |
| **Voice out** | Piper TTS — neural voice, runs locally |
| **Memory** | Vector search across your conversations |
| **Weather** | Open-Meteo — free, no API key |
| **Spotify** | Play, pause, volume, sleep timer |
| **Desktop** | Window management, typing, screenshots |
| **Web search** | DuckDuckGo + LLM synthesis |

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
