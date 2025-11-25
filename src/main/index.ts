import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import {
  addProjectNote,
  addTask,
  deleteProjectNote,
  deleteTask,
  getTasks,
  initDatabase,
  updateTask,
} from './db/database'
import { app, BrowserWindow, ipcMain } from './electron'
import type { TaskCategory } from '@shared/types'
import {
  closeTooDooOverlay,
  configureRendererTarget,
  createLauncherWindow,
  createTooDooOverlay,
  createQuickAddWindow,
  registerQuickAddShortcuts,
  unregisterQuickAddShortcuts,
  broadcastTaskChange,
  registerTranslyShortcut,
  unregisterTranslyShortcut,
  broadcastTranslyResult,
  registerTranslateOptionsShortcut,
  unregisterTranslateOptionsShortcut,
  createTranslateOptionsWindow,
  closeTranslateOptionsWindow,
  broadcastTranslateOptionsResult,
} from './windowManager'
import { correctFromActiveSelection, translateOptions, pasteSelectedOption } from './transly'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const devServerUrl =
  process.env.VITE_DEV_SERVER_URL || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || 'http://localhost:5173/'

const indexHtml = path.join(__dirname, '../../dist/index.html')

const bootstrap = async () => {
  initDatabase()
  configureRendererTarget({ devServerUrl, indexHtml })
  createLauncherWindow()
  registerQuickAddShortcuts()
}

app.whenReady().then(bootstrap)

const handleTranslyHotkey = async () => {
  // This function now handles the entire Copy -> API -> Paste flow
  const result = await correctFromActiveSelection()
  if (result) {
    broadcastTranslyResult(result)
  }
}

const handleTranslateOptionsHotkey = async () => {
  const result = await translateOptions()
  broadcastTranslateOptionsResult(result)
  if (result.options.length > 0) {
    createTranslateOptionsWindow(result.options, result.input)
  }
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLauncherWindow()
    registerQuickAddShortcuts()
  }
})

app.on('window-all-closed', () => {
  unregisterQuickAddShortcuts()
  unregisterTranslyShortcut()
  unregisterTranslateOptionsShortcut()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('toggle-tool', (_event: IpcMainEvent, toolName: string, isActive: boolean) => {
  if (toolName === 'TooDoo') {
    isActive ? createTooDooOverlay() : closeTooDooOverlay()
  } else if (toolName === 'Transly') {
    if (isActive) {
      registerTranslyShortcut(handleTranslyHotkey)
      registerTranslateOptionsShortcut(handleTranslateOptionsHotkey)
    } else {
      unregisterTranslyShortcut()
      unregisterTranslateOptionsShortcut()
    }
  }
})

// --- TooDoo Handlers ---
ipcMain.handle('tasks:list', (_event: IpcMainInvokeEvent) => getTasks())
ipcMain.handle(
  'tasks:add',
  (
    _event: IpcMainInvokeEvent,
    payload: { id: string; title: string; description?: string; category: TaskCategory; isDone?: boolean },
  ) => {
    const task = addTask(payload)
    broadcastTaskChange()
    return task
  },
)
ipcMain.handle(
  'tasks:update',
  (_event: IpcMainInvokeEvent, payload: { id: string; title?: string; description?: string | null; isDone?: boolean; category?: TaskCategory }) => {
    const task = updateTask(payload)
    broadcastTaskChange()
    return task
  },
)
ipcMain.handle('tasks:delete', (_event: IpcMainInvokeEvent, id: string) => {
  deleteTask(id)
  broadcastTaskChange()
  return { id }
})
ipcMain.handle('tasks:note:add', (_event: IpcMainInvokeEvent, payload: { id: string; taskId: string; content: string }) => {
  const note = addProjectNote(payload)
  broadcastTaskChange()
  return note
})
ipcMain.handle('tasks:note:delete', (_event: IpcMainInvokeEvent, id: string) => {
  deleteProjectNote(id)
  broadcastTaskChange()
  return { id }
})

ipcMain.on('quick-add:open', (_event: IpcMainEvent, category: string) => {
  createQuickAddWindow(category)
})

// --- Translate Options Handlers ---
ipcMain.on('translate-options:select', async (_event: IpcMainEvent, option: string) => {
  closeTranslateOptionsWindow()
  await pasteSelectedOption(option)
})

ipcMain.on('translate-options:close', () => {
  closeTranslateOptionsWindow()
})