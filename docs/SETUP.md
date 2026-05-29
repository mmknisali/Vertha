# Setup Guide

## Prerequisites

- Nix with flakes enabled (Linux, macOS, or Windows WSL)
- A microphone and speakers

## Environment Variables

### Root `.env.local`

```env
VITE_STT_URL=http://localhost:8765
VITE_TTS_URL=http://localhost:8766
VITE_ZEN_API_KEY=your_zen_api_key_here
```

The Zen API key is required for AI responses. Get one at [opencode.ai](https://opencode.ai).

### STT Service (`src/stt/.env.local`)

```env
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=whisper-large-v3-turbo
```

Get a Groq API key at [console.groq.com](https://console.groq.com).

### TTS Service (`src/tts/.env.local`)

```env
PIPER_VOICE=src/tts/voices/en_US-lessac-medium.onnx
```

The Piper voice model downloads automatically on first run.

### Optional: Spotify (`src/tts/.env.local`)

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_secret
```

Create a Spotify app at [developer.spotify.com](https://developer.spotify.com).

### Optional: PC Control (`src/tts/.env.local`)

```env
VERTHA_PC_CONTROL_ENABLED=true
VERTHA_DANGEROUS_TIER_ENABLED=true
```

## Running

```bash
devenv up
```

This starts all three services:
- Frontend at `http://localhost:5173`
- STT server at `http://localhost:8765`
- TTS server at `http://localhost:8766`

## Verifying Services

```bash
curl http://localhost:8765/health   # STT
curl http://localhost:8766/health   # TTS
```

## Wake Word Enrollment

Before using wake word detection, enroll your voice:

1. Navigate to Settings in the Vertha UI
2. Click "Enroll Voice"
3. Say "Hey Vertha" 3-5 times when prompted
4. Enrollment saves to `enrollments/vertha.pt`

The STT server reads this embedding to verify the speaker.
