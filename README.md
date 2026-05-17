# Misty AI

Misty AI is a personal AI command center built with TanStack Start, React, Supabase, Tauri, and local wake-word detection.

The app combines chat, voice input, memory, calendar/task-style workspace views, Spotify controls, usage tracking, and a desktop shell. The web app can run by itself, while the Tauri app wraps the same frontend for a native desktop experience.

## Stack

- Frontend: React 19, TanStack Start, TanStack Router, Vite
- Desktop: Tauri v2 with a Rust backend
- Data/Auth: Supabase
- AI: Google Gemini through the AI SDK
- Voice: Deepgram transcription, ElevenLabs TTS, optional local OpenWakeWord
- Styling: Tailwind CSS and Radix UI primitives
- Integrations: Google OAuth and Spotify OAuth

## Prerequisites

- Node.js 20+
- npm
- Python 3.10+ for the local wake-word server
- Rust toolchain (for Tauri desktop builds)
- Tauri CLI dependencies for your OS
- Supabase project credentials if you want auth, database, memory, and realtime features

## Setup

Install JavaScript dependencies:

```bash
npm install
```

Create a local `.env` file from `.env.example`, then fill in the services you use:

```powershell
Copy-Item .env.example .env
```

Important variables:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` power browser-side Supabase access.
- `SUPABASE_SERVICE_ROLE_KEY` is used only by server/API routes that need privileged database access.
- `GEMINI_API_KEY` enables AI responses.
- `DEEPGRAM_API_KEY` enables realtime speech transcription.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `ELEVENLABS_MODEL_ID` enable TTS.
- `VITE_OPENWAKEWORD_URL` points the app at the local wake-word server. The default is `http://127.0.0.1:8765`.
- `VITE_SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `VITE_SPOTIFY_REDIRECT_URI` enable Spotify OAuth and playback features.

Do not commit `.env`. It contains secrets and local credentials.

## Run (Web)

Start the web app:

```bash
npm run dev
```

The app runs through Vite/TanStack Start. Open the local URL printed by the dev server.

## Run (Desktop / Tauri)

Start the same app inside the Tauri desktop shell:

```bash
npm run tauri:dev
```

This requires Rust and the Tauri system dependencies for your OS. Use the web dev command first if you only need to test frontend changes.

## Run (OpenWakeWord Local Server)

Wake-word detection can run locally from `local-voice/`. This keeps wake-word inference on your machine and exposes a small local HTTP/WebSocket service to the app.

Initial setup:

```powershell
cd local-voice
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start the server:

```powershell
cd local-voice
.\.venv\Scripts\Activate.ps1
python wakeword-server.py
```

If `local-voice\models\Misty.onnx` exists, it is loaded automatically. Without that model, OpenWakeWord uses its default model behavior.

The app expects:

- `http://127.0.0.1:8765`
- `ws://127.0.0.1:8765/wake`

To use an explicit custom model:

```powershell
python wakeword-server.py --model .\models\Misty.onnx
```

Recommended local voice startup order:

1. Start `local-voice/wakeword-server.py`.
2. Start the web app with `npm run dev` or the desktop app with `npm run tauri:dev`.
3. Make sure the browser or desktop shell has microphone permission.

Browser-side OpenWakeWord assets can also live in `public/openwakeword/`, but the current reliable path is the local Python server.

## Supabase

Database migrations live in `supabase/migrations/`.

Use these migrations to reproduce the schema for profiles, AI memory, realtime voice data, usage metrics, and related app tables. The `supabase/.temp/` folder is local CLI state and should not be treated as portable project source.

## Build

Build the web app:

```bash
npm run build
```

Build the desktop app:

```bash
npm run tauri:build
```

Run a local production preview:

```bash
npm run preview
```

## Quality Commands

Lint the repository:

```bash
npm run lint
```

Format files:

```bash
npm run format
```

## Project Structure

- `src/` contains the React/TanStack app, routes, components, hooks, services, and voice logic.
- `src/routes/` contains app pages and API routes.
- `src/lib/` contains shared services, storage helpers, integration clients, hooks, and voice utilities.
- `src-tauri/` contains the Tauri desktop app, Rust entrypoint, config, icons, and desktop build metadata.
- `supabase/migrations/` contains database schema and migration files.
- `local-voice/` contains the Python OpenWakeWord server and model folder.
- `public/openwakeword/` is reserved for optional browser wake-word runtime assets.

## Troubleshooting

- `npm run tauri:dev` fails: confirm Rust and Tauri OS dependencies are installed, then try `npm run dev` to isolate frontend issues.
- Wake word does not trigger: start `local-voice/wakeword-server.py`, confirm `VITE_OPENWAKEWORD_URL=http://127.0.0.1:8765`, and check microphone permissions.
- Port `8765` is busy: stop the other process or change the wake-word server/app URL together.
- AI chat fails: confirm `GEMINI_API_KEY` and `GEMINI_MODEL` are set.
- Voice transcription fails: confirm `DEEPGRAM_API_KEY` is set.
- TTS fails: confirm the ElevenLabs variables are set.
- Spotify callback fails: confirm `VITE_SPOTIFY_REDIRECT_URI` matches the redirect URI configured in the Spotify developer dashboard.

## Notes

- Keep secrets out of Git; use `.env` locally.
- Generated build output should remain ignored via `.gitignore`.
- Commit source, migrations, docs, and configuration. Do not commit `node_modules/`, Tauri build output, local Supabase temp state, or generated caches.

## Quick Command Flow

```powershell
npm install
Copy-Item .env.example .env
cd \local-voice
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python wakeword-server.py
```

```powershell
npm run dev
```

```powershell
npm run tauri:dev
```

```powershell
npm run build
npm run tauri:build
```
