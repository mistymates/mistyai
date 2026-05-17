# Misty AI

Misty AI is a personal AI command center built with TanStack Start, React, Supabase, and Tauri.

## Stack

- Frontend: React 19 + TanStack Start + Vite
- Desktop: Tauri v2 (Rust backend)
- Data/Auth: Supabase
- Styling: Tailwind CSS

## Prerequisites

- Node.js 20+
- npm
- Rust toolchain (for Tauri desktop builds)
- Tauri CLI dependencies for your OS

## Setup

```bash
npm install
```

Create environment variables in `.env` (use `.env.example` as the starting point).

## Run (Web)

```bash
npm run dev
```

## Run (Desktop / Tauri)

```bash
npm run tauri:dev
```

## Build

```bash
npm run build
```

Desktop build:

```bash
npm run tauri:build
```

## Project Structure

- `src/` application frontend code
- `src-tauri/` Tauri desktop app and Rust entrypoint
- `supabase/migrations/` database schema and migration files
- `local-voice/` local voice service utilities

## Notes

- Keep secrets out of Git; use `.env` locally.
- Generated build output should remain ignored via `.gitignore`.
