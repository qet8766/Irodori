# Irodori — Electron tool launcher

Irodori is an Electron shell for hosting a growing collection of small tools. The first embedded tool is **TooDoo**, an always-on-top overlay todo widget backed by an offline-first SQLite queue.

## Quick start

```bash
npm install
npm run dev           # starts Vite + Electron with auto-reload
```

Production build + pack (optional):

```bash
npm run electron:build
```

## Key scripts

- `npm run dev` / `npm run electron:dev` — Vite dev server plus Electron main/preload via `vite-plugin-electron`.
- `npm run build` — typecheck then build renderer + Electron bundles.
- `npm run electron:build` — build and package with `electron-builder`.

## Project layout

```
src/
  main/        # Electron main process (window manager, IPC, DB)
  preload/     # Exposed bridge API for renderer
  renderer/    # React HashRouter UI (launcher + TooDoo overlay)
  shared/      # Shared types (Todo)
```

## Notes

- Local storage lives at `{userData}/irodori.db` (better-sqlite3). All CRUD actions are mirrored into `sync_queue` for future cloud syncing.
- Launcher toggles the TooDoo overlay through IPC; the overlay runs with a transparent, always-on-top window and a drag handle across the header surface.
- Styling favors a glassy, neon-leaning palette to make the overlay legible on transparent backgrounds.
