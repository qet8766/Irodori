# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server + Electron with hot reload
npm run build            # TypeScript check + build renderer and Electron
npm run electron:build   # Full production build + package with electron-builder
npm run lint             # ESLint
```

### Server (runs on Synology NAS)

```bash
cd server
npm install
npm start                # Start REST API server on port 3456
docker-compose up -d     # Deploy via Docker
```

## Architecture Overview

Irodori is an Electron desktop app that hosts multiple overlay tools. Each tool can be toggled on/off from the main launcher window.

```
┌─────────────────────┐         ┌─────────────────────────┐
│   Electron App      │  HTTP   │   Synology NAS          │
│   (Windows PC)      │ ◄─────► │   (Docker Container)    │
│                     │         │                         │
│  - fetch() calls    │         │  - Node.js REST API     │
│  - Local JSON cache │         │  - SQLite database      │
│  - Offline queue    │         │  - Port 3456            │
└─────────────────────┘         └─────────────────────────┘
```

### Process Structure

```
src/
├── main/                      # Electron main process
│   ├── index.ts               # Bootstrap (app.whenReady)
│   ├── app.ts                 # App lifecycle & initialization
│   ├── broadcast.ts           # IPC broadcast utilities
│   ├── electron.ts            # Electron re-exports
│   ├── db/
│   │   └── database.ts        # Database, sync queue, offline support
│   ├── ipc/
│   │   ├── index.ts           # IPC registry (registerAllIpc)
│   │   ├── tasks.ipc.ts       # Task CRUD handlers
│   │   ├── notes.ipc.ts       # Note CRUD handlers
│   │   ├── airu.ipc.ts        # Airu handlers
│   │   ├── transly.ipc.ts     # Transly handlers
│   │   ├── settings.ipc.ts    # Settings handlers
│   │   └── tools.ipc.ts       # Tool toggle handlers
│   ├── services/
│   │   ├── transly.service.ts # GPT-5.1 typo correction & translation
│   │   ├── airu.service.ts    # Multi-provider LLM execution
│   │   └── keyboard.service.ts# PowerShell keyboard simulation
│   ├── shortcuts/
│   │   ├── index.ts           # Re-exports
│   │   ├── definitions.ts     # Shortcut ID & accelerator mappings
│   │   └── manager.ts         # Register/unregister logic
│   └── windows/
│       ├── index.ts           # Re-exports all window functions
│       ├── base.ts            # Window factory, loadRoute, computeCursorPosition
│       ├── launcher.ts        # Main launcher window
│       ├── overlays/
│       │   ├── toodoo.ts      # TooDoo overlay
│       │   └── notetank.ts    # NoteTank overlay
│       └── popups/
│           ├── quick-add.ts   # Quick-add popup
│           ├── translate-options.ts
│           ├── note-editor.ts
│           ├── airu-popup.ts
│           └── airu-prompt-editor.ts
├── preload/
│   ├── index.ts               # contextBridge exposing window.irodori
│   └── types.d.ts             # Window.irodori type declarations
├── renderer/
│   ├── main.tsx               # Entry point
│   ├── App.tsx                # Routes (HashRouter)
│   ├── index.css              # All styling
│   ├── store/tools.ts         # Zustand store for tool states
│   ├── hooks/
│   │   ├── index.ts           # Re-exports
│   │   ├── useIpcListener.ts  # Generic IPC listener hook
│   │   ├── useTasks.ts        # Task data + listener
│   │   ├── useNotes.ts        # Notes data + listener
│   │   ├── useAiruPrompts.ts  # Airu prompts data + listener
│   │   └── useSyncStatus.ts   # Sync status polling
│   ├── components/
│   │   └── ToolToggleCard.tsx
│   └── pages/
│       ├── Launcher/
│       └── Tools/
│           ├── TooDoo/
│           ├── NoteTank/
│           ├── Transly/
│           └── Airu/
├── shared/
│   └── types.ts               # Shared TypeScript types
└── server/                    # REST API for Synology NAS
```

### IPC Communication Pattern

1. Renderer calls `window.irodori.*` methods (defined in `src/preload/index.ts`)
2. Preload forwards to main process via `ipcRenderer.invoke()` or `ipcRenderer.send()`
3. Main process handles in `src/main/ipc/*.ipc.ts` via `ipcMain.handle()` or `ipcMain.on()`
4. Data changes broadcast via `src/main/broadcast.ts` to all windows

### Window Management (`src/main/windows/`)

Window factory in `base.ts` provides:
- `createWindow(config)` - Creates BrowserWindow with standard options
- `loadRoute(win, route)` - Loads route via dev server or file://
- `computeCursorPosition(w, h)` - Positions popup near cursor

Window modules:
- `launcher.ts` - Main launcher window (800x600, resizable)
- `overlays/toodoo.ts` - Transparent always-on-top task overlay
- `overlays/notetank.ts` - Transparent notes overlay
- `popups/quick-add.ts` - Quick-add positioned near cursor
- `popups/translate-options.ts` - Translation options dropdown
- `popups/note-editor.ts` - Note editor modal
- `popups/airu-popup.ts` - AI prompt popup
- `popups/airu-prompt-editor.ts` - Prompt editor modal

### Shortcut Management (`src/main/shortcuts/`)

- `definitions.ts` - Maps ShortcutId to accelerator strings
- `manager.ts` - `registerShortcut(id, handler)`, `unregisterShortcut(id)`, `unregisterAllShortcuts()`

### Database (`src/main/db/database.ts`)

- **Local cache**: JSON file at `{userData}/irodori-store.json`
- **Remote storage**: REST API on Synology NAS (`server/`)
- **Offline support**: Changes queued locally, synced when online
- **Sync scheduler**: Runs every 30 seconds via `startSyncScheduler()`

Data flow:
1. All reads check server first, fall back to local cache if offline
2. All writes update local cache immediately, then push to server
3. Failed pushes are queued and retried automatically

### Server API (`server/`)

REST API endpoints:
- `GET/POST /api/tasks` - Task CRUD
- `PUT/DELETE /api/tasks/:id` - Task update/delete
- `POST /api/tasks/:taskId/notes` - Add project note
- `DELETE /api/tasks/notes/:id` - Delete project note
- `GET/POST /api/notes` - NoteTank CRUD
- `PUT/DELETE /api/notes/:id` - Note update/delete
- `GET/POST /api/airu/prompts` - Airu prompts CRUD
- `PUT/DELETE /api/airu/prompts/:id` - Prompt update/delete
- `PUT /api/airu/prompts/reorder` - Reorder prompts

### Embedded Tools

| Tool | Hotkeys | Description |
|------|---------|-------------|
| **TooDoo** | Alt+Shift+S/L/P/I | Task manager with 4 categories (short_term, long_term, project, immediate) |
| **Transly** | Alt+Shift+T (correct), Alt+Shift+K (translate) | Typo correction and Korean-English translation via OpenAI GPT-5.1 |
| **NoteTank** | Alt+Shift+N | Quick notes overlay |
| **Airu** | Alt+Shift+A | AI prompt runner (OpenAI, Gemini, Claude) with customizable prompts |

### Renderer Routes

Routes are defined in `src/renderer/App.tsx` and loaded via HashRouter:
- `/` - Launcher (includes server settings)
- `/toodoo` - TooDoo overlay
- `/quick-add` - Quick add popup
- `/transly` - Transly debug view
- `/translate-options` - Translation options popup
- `/notetank` - NoteTank overlay
- `/note-editor` - Note editor popup
- `/airu-popup` - Airu popup
- `/airu-prompt-editor` - Prompt editor

### React Hooks (`src/renderer/hooks/`)

- `useTasks()` - Fetch tasks with auto-refresh on change
- `useNotes()` - Fetch notes with auto-refresh on change
- `useAiruPrompts()` - Fetch Airu prompts with auto-refresh on change
- `useSyncStatus()` - Poll sync status (online, pending count, last sync)
- `useTasksListener(callback)` - Listen for task changes
- `useNotesListener(callback)` - Listen for note changes
- `useAiruPromptsListener(callback)` - Listen for prompt changes

### State Management

- Zustand store in `src/renderer/store/tools.ts` manages which tools are active
- Each tool's active state syncs to main process via `window.irodori.toggleTool()`

## Path Aliases

Configured in `vite.config.ts`:
- `@renderer` -> `src/renderer`
- `@main` -> `src/main`
- `@preload` -> `src/preload`
- `@shared` -> `src/shared`

## Deployment

See `server/DEPLOY.md` for Synology NAS deployment instructions.
