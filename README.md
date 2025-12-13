# Irodori — Electron tools deck

Irodori is a Windows-focused Electron desktop app: a launcher window that hosts a small set of utilities implemented as always-on-top overlays and cursor-positioned popups.

## Tools

- **TooDoo** — always-on-top todo overlay with category buckets and quick-add popups (hotkeys per category).
- **Transly** — global-hotkey clipboard helper (copy selection → call OpenAI → paste correction) plus “translation options” popup.
- **NoteTank** — notes overlay + note editor popup (Ctrl+F search inside the overlay).
- **Airu** — global-hotkey LLM prompt popup + prompt editor (OpenAI implemented; Gemini/Claude placeholders).

## Quick start

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev              # Vite + Electron (auto-reload)
npm run build            # TypeScript check + Vite build
npm run electron:build   # Build + package (electron-builder)
npm run lint             # ESLint
```

## Data & sync

The Electron app stores a local JSON cache at `{app.getPath('userData')}/irodori-store.json` and maintains a `syncQueue` of pending REST operations while offline (see `src/main/db/database.ts`).

An optional companion server lives in `server/` (Express + JSON file storage at `${DATA_DIR}/irodori-data.json`) and exposes:
- `GET /api/health`
- `GET/POST/PUT/DELETE /api/tasks` (+ project notes endpoints)
- `GET/POST/PUT/DELETE /api/notes`
- `GET/POST/PUT/DELETE /api/airu/prompts` (+ reorder)

The app’s API URL is configurable in the launcher settings (default `http://localhost:3456`).

## Hotkeys

Defined in `src/main/shortcuts/definitions.ts`:

- TooDoo quick add: `Alt+Shift+S` (short-term), `Alt+Shift+L` (long-term), `Alt+Shift+P` (project), `Alt+Shift+I` (immediate)
- Transly: `Alt+Shift+T` (correct selection), `Alt+Shift+K` (translation options)
- NoteTank: `Alt+Shift+N` (open note editor popup)
- Airu: `Alt+Shift+A` (open Airu popup)

Windows-only detail: Transly and Airu use a PowerShell + C# `SendInput` worker to send Ctrl+C / Ctrl+V to the active app (`src/main/services/keyboard.service.ts`).

## Project layout

```
src/
  main/        Electron main process (windows, IPC, shortcuts, sync, services)
  preload/     Context bridge exposing window.irodori
  renderer/    React UI (HashRouter)
  shared/      Shared TypeScript domain types
server/        Optional REST API server (Express + JSON storage)
```

## Environment variables

- `OPENAI_API_KEY` — required for Transly hotkeys (OpenAI Responses API).
- Airu uses an in-app OpenAI API key setting (editable in the Airu debug window) rather than `OPENAI_API_KEY`.
- `server/` supports `PORT` (default `3456`) and `DATA_DIR` for JSON storage.

## Build notes

- This repo targets Windows; packaging is done via `electron-builder` (`npm run electron:build`).
- `server/` is pure Node.js (no native DB modules). Docker is supported via `server/docker-compose.yml`.
