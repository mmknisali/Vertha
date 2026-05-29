# Features

Vertha is a voice assistant that runs entirely in your browser with local speech processing and cloud AI.

## Voice Interaction

### Wake Word

Say "Hey Vertha" to activate. Uses speaker verification against your enrolled voice to prevent false triggers.

**Technical details:**
- Silero VAD detects speech in 512-sample windows
- SpeechBrain ECAPA-TDNNB compares against enrolled embedding
- 2-second debounce between detections
- Cosine similarity threshold: 0.15

### Speech Recognition

After wake word, speak your command. Audio streams to the STT server which sends it to Groq Whisper (whisper-large-v3-turbo).

**Silence detection:**
- Stops recording after 3.5 seconds of silence
- Minimum utterance: 1.5 seconds
- Maximum recording: 20 seconds

### Text-to-Speech

Responses are synthesized locally using Piper neural TTS. Audio plays immediately without typing animation.

## Memory

Vertha remembers things you tell it to remember and uses past conversations as context.

**Auto-pin:** Saying things like "remember that", "don't forget", or "keep in mind" automatically saves the message to pinned memories.

**Search:** When you ask about something from a past conversation, Vertha searches your memory using embeddings to find relevant context.

**Sessions:** Conversations are grouped into sessions. Session summaries are stored but not yet generated via LLM.

**Storage:**
- Vectors: ChromaDB (`all-MiniLM-L6-v2`)
- Data: SQLite
- Location: `~/.local/share/vertha/memory/`

## Weather

Says the current temperature and conditions. Uses Open-Meteo (free, no API key).

Set your location in Settings (latitude/longitude).

## Spotify

Control playback on any active Spotify device.

**What works:**
- Start playback of albums/playlists (via URI)
- Pause/resume
- Set volume
- Sleep timer (auto-pause after N minutes)

**Requirements:**
- Spotify Premium
- Active device with Spotify open

**Note:** Spotify authentication happens once via OAuth. Visit `/spotify/auth` to start.

## PC Control

Control your Linux desktop via voice.

### Safe Actions (no confirmation)

- List open windows
- Focus a window by title
- Get system info (uptime, memory, time)
- Get screen resolution

### Moderate Actions (confirmation always required)

- Type text
- Press keyboard keys
- Click mouse
- Scroll
- Take screenshot
- Adjust volume
- Lock screen

### Dangerous Actions (requires enabling in settings)

- Run arbitrary shell commands
- Delete files
- Kill processes

All dangerous actions have blocklists to prevent catastrophic commands (`rm -rf /`, etc.).

## Proactive Suggestions

Vertha occasionally speaks without being asked:

- **Morning briefing** (8:00 AM) — "Good morning, sir..."
- **Night routine** (11:00 PM) — "It's getting late, sir..."
- **Upcoming events** — Alerts when you have something in 15 minutes
- **Break reminders** — After 90 minutes of continuous activity

## Web Search

Ask questions that need current information. Uses DuckDuckGo with LLM synthesis to return a 2-4 sentence spoken answer.

Requires `ZEN_API_KEY` configured.

## Context Resolution

When you say "what about that" or "do it again", Vertha tracks what you're referring to and resolves the ambiguity before sending to the AI.

Tracks: last topic, last tool used, last location mentioned, last search query.

## Emotion Detection

Detects if you're frustrated, happy, or tired from your message. Adjusts responses accordingly:

- **Frustrated** — Extra calm, concise, solutions-focused, minimal filler
- **Happy** — Slightly warmer tone
- **Tired** — Very short responses
- **Neutral** — Normal behavior
