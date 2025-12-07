import type { IpcMain } from 'electron'
import { registerTasksIpc } from './tasks.ipc'
import { registerNotesIpc } from './notes.ipc'
import { registerAiruIpc } from './airu.ipc'
import { registerTranslyIpc } from './transly.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerToolsIpc } from './tools.ipc'

type ToolHandlers = {
  onTranslyCorrect: () => void | Promise<void>
  onTranslyTranslate: () => void | Promise<void>
  onNoteTankEditor: () => void | Promise<void>
  onAiruPopup: () => void | Promise<void>
}

export const registerAllIpc = (ipcMain: IpcMain, toolHandlers: ToolHandlers) => {
  registerTasksIpc(ipcMain)
  registerNotesIpc(ipcMain)
  registerAiruIpc(ipcMain)
  registerTranslyIpc(ipcMain)
  registerSettingsIpc(ipcMain)
  registerToolsIpc(ipcMain, toolHandlers)

  console.info('[IPC] All handlers registered')
}

export { registerTasksIpc } from './tasks.ipc'
export { registerNotesIpc } from './notes.ipc'
export { registerAiruIpc } from './airu.ipc'
export { registerTranslyIpc } from './transly.ipc'
export { registerSettingsIpc } from './settings.ipc'
export { registerToolsIpc } from './tools.ipc'
