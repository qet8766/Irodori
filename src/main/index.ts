import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addTodo,
  deleteTodo,
  getTodos,
  initDatabase,
  startSyncHeartbeat,
  stopSyncHeartbeat,
  toggleTodo,
} from './db/database'
import { app, BrowserWindow, ipcMain } from './electron'
import { closeTooDooOverlay, configureRendererTarget, createLauncherWindow, createTooDooOverlay } from './windowManager'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const devServerUrl =
  process.env.VITE_DEV_SERVER_URL || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || 'http://localhost:5173/'

const indexHtml = path.join(__dirname, '../../dist/index.html')

const bootstrap = async () => {
  initDatabase()
  configureRendererTarget({ devServerUrl, indexHtml })
  startSyncHeartbeat()
  createLauncherWindow()
}

app.whenReady().then(bootstrap)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLauncherWindow()
  }
})

app.on('window-all-closed', () => {
  stopSyncHeartbeat()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('toggle-tool', (_event, toolName: string, isActive: boolean) => {
  if (toolName === 'TooDoo') {
    isActive ? createTooDooOverlay() : closeTooDooOverlay()
  }
})

ipcMain.handle('todos:list', () => getTodos())
ipcMain.handle('todos:add', (_event, payload: { id: string; content: string; isDone?: boolean }) =>
  addTodo(payload),
)
ipcMain.handle('todos:toggle', (_event, payload: { id: string; isDone?: boolean }) =>
  toggleTodo(payload.id, payload.isDone),
)
ipcMain.handle('todos:delete', (_event, id: string) => {
  deleteTodo(id)
  return { id }
})
