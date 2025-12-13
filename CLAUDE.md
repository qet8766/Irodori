# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Irodori is a Windows-focused Electron desktop “tools deck”: a launcher window plus a set of small utilities implemented as always-on-top overlays and cursor-positioned popups.

Current tools:
- **TooDoo** — always-on-top todo overlay with category buckets and a quick-add popup opened via hotkeys.
- **Transly** — global-hotkey clipboard helper (copy selection → call OpenAI → paste correction) plus a “translation options” popup.
- **NoteTank** — notes overlay + a small note editor popup (Ctrl+F search inside the overlay).
- **Airu** — global-hotkey LLM prompt popup + prompt editor (OpenAI implemented; Gemini/Claude placeholders).

Stack: Electron + React 19 + TypeScript + Vite (`vite-plugin-electron`) + Zustand.

## Commands

```bash
npm run dev              # Development server with hot reload
npm run build            # TypeScript check + Vite build
npm run electron:build   # Full build + package .exe/.nsis
npm run lint             # ESLint
```

## Architecture

**Three-process Electron model:**
- `src/main/` — main process: window creation, IPC handlers, global shortcuts, sync + LLM services
- `src/preload/` — context bridge exposing `window.irodori` to the renderer (typed in TS)
- `src/renderer/` — React UI (HashRouter) for launcher/overlays/popups

**Routing / windows:** the main process loads renderer routes as hash paths (e.g. `#/toodoo`). Window creation is centralized in `src/main/windows/base.ts` and specialized per window in `src/main/windows/**`.

**IPC flow:** renderer calls `window.irodori.*` → preload uses `ipcRenderer.invoke/send` → main handles via `ipcMain.handle/on` → main broadcasts cross-window events via `src/main/broadcast.ts` (e.g. `tasks:changed`) which the renderer subscribes to.

**Tool toggle pattern:** the launcher UI stores toggle state in Zustand (`src/renderer/store/tools.ts`) and calls `window.irodori.toggleTool(...)`, which the main process maps to “create/close overlay” and/or “register/unregister hotkeys”.

## Data & Sync

The Electron app runs in “local cache + REST sync” mode:

- Local persistence is a JSON file at `{app.getPath('userData')}/irodori-store.json` (see `src/main/db/database.ts`).
- A `syncQueue` array stores pending REST operations while offline. Operations are coalesced by `(table, recordId)` and retried up to 5 times.
- A background scheduler polls `/api/health` and (when online) pulls the latest `/api/tasks`, `/api/notes`, and `/api/airu/prompts` into the local cache.

The companion sync server lives in `server/`:
- Express REST API (`server/index.js`) on `PORT` (default `3456`).
- File-backed JSON store (`server/store.js`) stored at `${DATA_DIR}/irodori-data.json`.
- NAS/Docker deployment docs: `server/DEPLOY.md` and `server/docker-compose.yml`.

## Hotkeys

Defined in `src/main/shortcuts/definitions.ts`:
- TooDoo quick add: `Alt+Shift+S` (short-term), `Alt+Shift+L` (long-term), `Alt+Shift+P` (project), `Alt+Shift+I` (immediate)
- Transly: `Alt+Shift+T` (correct selection), `Alt+Shift+K` (translation options popup)
- NoteTank: `Alt+Shift+N` (open note editor popup). Overlay visibility is toggled from the launcher.
- Airu: `Alt+Shift+A` (open Airu popup)

Windows-only detail: Transly and Airu use `src/main/services/keyboard.service.ts` (PowerShell + C# `SendInput`) to send Ctrl+C / Ctrl+V to the active app.

## Key Files

- `src/main/index.ts` — main process entry (configured in `vite.config.ts`), bootstrap + most IPC wiring
- `src/main/windows/base.ts` — window factory (`launcher` / `overlay` / `popup`) and route loading
- `src/main/db/database.ts` — local JSON store + REST sync queue/scheduler
- `src/main/services/transly.service.ts` — OpenAI-driven “copy → fix → paste” + translation options
- `src/main/services/airu.service.ts` — Airu provider calls (OpenAI implemented; Gemini/Claude placeholders)
- `src/preload/index.ts` — `window.irodori` API implementation
- `src/preload/types.d.ts` — `window.irodori` TypeScript typings
- `src/renderer/App.tsx` — routes for launcher/overlays/popups
- `src/shared/types.ts` — shared domain types
- `server/index.js` / `server/store.js` — REST API + JSON-backed persistence

## Env / Config

- `OPENAI_API_KEY` — required for Transly hotkeys (OpenAI Responses API; see `src/main/services/transly.service.ts`).
- Airu stores its provider credentials/settings in the local store via `window.irodori.airu.settings.*` (editable in the Airu debug page).
- Server: `PORT`, `DATA_DIR`.
- In-app: API URL is editable in the launcher settings and persisted in the local store.

## Build Requirements

- **Node.js 18+** (see `scripts/build.ps1`).
- **Windows** is assumed for full functionality (global shortcuts + clipboard/keyboard injection via PowerShell/C#).
- Packaging installers (`npm run electron:build`) uses `electron-builder` (Windows targets: portable + NSIS).
- The optional `server/` component is pure Node.js (no native DB modules).

## Notes for Changes

- When adding/removing IPC APIs, update `src/preload/index.ts`, `src/preload/types.d.ts`, and the matching `ipcMain` handler(s) in `src/main/index.ts`.
- There is some duplicated/legacy wiring under `src/main/ipc/` and `src/main/app.ts`; the shipped Electron entrypoint is `src/main/index.ts` (per `vite.config.ts`).
