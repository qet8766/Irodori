# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Irodori is an Electron desktop application for Windows - a tool launcher with modular utilities (TooDoo, Transly, NoteTank, Airu). Built with React 19, TypeScript, Vite, and SQLite.

## Commands

```bash
npm run dev              # Development server with hot reload
npm run build            # TypeScript check + Vite build
npm run electron:build   # Full build + package .exe/.nsis
npm run lint             # ESLint
```

## Architecture

**Three-process Electron model:**
- `src/main/` - Main process: window management, IPC handlers, database, hotkeys, LLM APIs
- `src/preload/` - Bridge exposing `window.irodori` API to renderer
- `src/renderer/` - React UI with hash router

**IPC flow:** Renderer calls `window.irodori.*` methods → preload invokes IPC → main process handles and returns

**Tool pattern:** Each tool (TooDoo, Transly, NoteTank, Airu) has:
- Main process logic for hotkeys and backend operations
- Renderer page component in `src/renderer/pages/Tools/`
- Toggle state managed in Zustand store (`src/renderer/store/tools.ts`)

**Database:** SQLite via better-sqlite3 at `{userData}/irodori.db`
- All tables use soft delete (`isDeleted` flag) with `sync_queue` for cloud sync
- CRUD operations in `src/main/db/database.ts`

**Hotkeys:**
- Shift+Alt+T: Transly (clipboard text correction)
- Shift+Alt+N: NoteTank overlay
- Shift+Alt+A: Airu popup

## Key Files

- `src/main/index.ts` - Main process bootstrap, all IPC handlers
- `src/main/windowManager.ts` - Window lifecycle and creation
- `src/preload/index.ts` - Context bridge API definitions
- `src/renderer/App.tsx` - React router with tool routes
- `src/shared/types.ts` - Shared TypeScript interfaces

## Build Requirements

Windows with MSVS 2022 and Python 3.11 for native module compilation (better-sqlite3). See `.npmrc` for paths.
