# Repository Guidelines

## Project Structure & Module Organization
- App lives in `src/`: `main/` (Electron process, IPC, shortcuts, sync), `preload/` (context bridge exposing `window.irodori`), `renderer/` (React HashRouter UI), `shared/` (TypeScript domain types).  
- Static assets sit in `public/`; built bundles land in `dist/` (renderer) and `dist-electron/` (main/preload).  
- Optional companion API: `server/` (Express + JSON file store, Docker support). Desktop package output is written to `release/` when built via electron-builder.

## Build, Test, and Development Commands
- `npm install` — install app dependencies. Run once per clone.  
- `npm run dev` — Vite + Electron with auto-reload; opens the launcher window.  
- `npm run build` — type-check (`tsc -b`) then produce production Vite build.  
- `npm run electron:build` — full desktop package via electron-builder (Windows targets: portable & NSIS).  
- `npm run lint` — ESLint over all TypeScript/React files.  
- Server: `npm --prefix server install`, then `npm --prefix server run dev` (watch) or `npm --prefix server start`; `docker-compose up` in `server/` to run via Docker.

## Coding Style & Naming Conventions
- Language: TypeScript ES2020 modules; React 19 with hooks; Zustand for state.  
- Indentation: 2 spaces; prefer named exports; keep files small and feature-focused.  
- Components and hooks: `PascalCase` for components, `useCamelCase` for hooks; utility functions `camelCase`.  
- Share types through `src/shared`; avoid duplicating request/response shapes.  
- Lint before pushing; align with `eslint.config.js` (JS/TS recommended + React hooks/refresh rules).

## Testing Guidelines
- No automated test suite yet; add coverage when touching critical flows. Favor small integration checks (renderer + IPC) and contract tests for `server/` routes.  
- Place future client tests adjacent to modules (e.g., `renderer/foo/foo.test.tsx`) and name with the `.test.ts[x]` suffix.

## Commit & Pull Request Guidelines
- Follow the existing log style: short, imperative messages (e.g., “Fix Vite dev server”).  
- Include PR notes: what changed, why, and any user-facing impact; link issues.  
- For UI tweaks, attach a screenshot/GIF; for keyboard/shortcut changes, list affected accelerators.  
- Ensure `npm run lint` (and any added tests) are green before requesting review.

## Security & Configuration Tips
- API keys: `OPENAI_API_KEY` powers Transly; Airu reads its key from the in-app settings window.  
- Local data persists at `{app.getPath('userData')}/irodori-store.json`; server JSON lives under `${DATA_DIR}` (default `server/data`).  
- If you add new IPC channels, register them in `src/main/index.ts` and mirror types in `src/shared` to keep preload/renderer safe.
