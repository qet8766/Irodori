import path from 'node:path'
import { app, BrowserWindow, ipcMain } from './electron'
import { initDatabase } from './db/database'
import { configureRendererTarget, createLauncherWindow, createTranslateOptionsWindow, createNoteEditorWindow, createAiruPopupWindow } from './windows'
import { registerAllIpc } from './ipc'
import { registerShortcut, unregisterAllShortcuts, TOODOO_CATEGORY_SHORTCUTS } from './shortcuts'
import { correctFromActiveSelection, translateOptions, type TranslyResult, type TranslateOptionsResult } from './services/transly.service'
import { broadcast, CHANNELS } from './broadcast'
import { createQuickAddWindow } from './windows'

const devServerUrl =
  process.env.VITE_DEV_SERVER_URL || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || 'http://localhost:5173/'

const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')

// Tool hotkey handlers
const handleTranslyCorrect = async () => {
  const result = await correctFromActiveSelection()
  if (result) {
    broadcast<TranslyResult>(CHANNELS.TRANSLY_RESULT, result)
  }
}

const handleTranslyTranslate = async () => {
  const result = await translateOptions()
  broadcast<TranslateOptionsResult>(CHANNELS.TRANSLY_OPTIONS_RESULT, result)
  if (result.options.length > 0) {
    createTranslateOptionsWindow(result.options, result.input)
  }
}

const handleNoteTankEditor = () => {
  createNoteEditorWindow()
}

const handleAiruPopup = () => {
  createAiruPopupWindow()
}

// Register TooDoo quick-add shortcuts
const registerTooDooShortcuts = () => {
  Object.entries(TOODOO_CATEGORY_SHORTCUTS).forEach(([_accelerator, category]) => {
    const id = `toodoo:${category}` as const
    registerShortcut(id, () => {
      createQuickAddWindow(category)
    })
  })
}

export const bootstrap = async () => {
  // Initialize database and sync scheduler
  initDatabase()

  // Configure renderer target for window creation
  configureRendererTarget({ devServerUrl, indexHtml })

  // Create main launcher window
  createLauncherWindow()

  // Register TooDoo quick-add shortcuts (always active)
  registerTooDooShortcuts()

  // Register all IPC handlers
  registerAllIpc(ipcMain, {
    onTranslyCorrect: handleTranslyCorrect,
    onTranslyTranslate: handleTranslyTranslate,
    onNoteTankEditor: handleNoteTankEditor,
    onAiruPopup: handleAiruPopup,
  })

  console.info('[Irodori] App bootstrapped')
}

export const handleActivate = () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLauncherWindow()
    registerTooDooShortcuts()
  }
}

export const handleAllWindowsClosed = () => {
  unregisterAllShortcuts()
  if (process.platform !== 'darwin') {
    app.quit()
  }
}
