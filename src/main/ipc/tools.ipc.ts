import type { IpcMain, IpcMainEvent } from 'electron'
import {
  createTooDooOverlay,
  closeTooDooOverlay,
  createQuickAddWindow,
  createNoteTankOverlay,
  closeNoteTankOverlay,
  createNoteEditorWindow,
  closeNoteEditorWindow,
} from '../windows'
import { registerShortcut, unregisterShortcut } from '../shortcuts'

type ToolHandlers = {
  onTranslyCorrect: () => void | Promise<void>
  onTranslyTranslate: () => void | Promise<void>
  onNoteTankEditor: () => void | Promise<void>
  onAiruPopup: () => void | Promise<void>
}

export const registerToolsIpc = (ipcMain: IpcMain, handlers: ToolHandlers) => {
  ipcMain.on('toggle-tool', (_event: IpcMainEvent, toolName: string, isActive: boolean) => {
    switch (toolName) {
      case 'TooDoo':
        isActive ? createTooDooOverlay() : closeTooDooOverlay()
        break

      case 'Transly':
        if (isActive) {
          registerShortcut('transly:correct', handlers.onTranslyCorrect)
          registerShortcut('transly:translate', handlers.onTranslyTranslate)
        } else {
          unregisterShortcut('transly:correct')
          unregisterShortcut('transly:translate')
        }
        break

      case 'NoteTank':
        if (isActive) {
          createNoteTankOverlay()
          registerShortcut('notetank:editor', handlers.onNoteTankEditor)
        } else {
          closeNoteTankOverlay()
          unregisterShortcut('notetank:editor')
        }
        break

      case 'Airu':
        if (isActive) {
          registerShortcut('airu:popup', handlers.onAiruPopup)
        } else {
          unregisterShortcut('airu:popup')
        }
        break
    }
  })

  ipcMain.on('quick-add:open', (_event: IpcMainEvent, category: string) => {
    createQuickAddWindow(category)
  })

  ipcMain.on('note-editor:open', (_event: IpcMainEvent, noteId?: string) => {
    createNoteEditorWindow(noteId)
  })

  ipcMain.on('note-editor:close', () => {
    closeNoteEditorWindow()
  })
}
