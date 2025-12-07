import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { getNotes, addNote, updateNote, deleteNote } from '../db/database'
import { broadcastNoteChange } from '../broadcast'

export const registerNotesIpc = (ipcMain: IpcMain) => {
  ipcMain.handle('notes:list', () => getNotes())

  ipcMain.handle(
    'notes:add',
    (_event: IpcMainInvokeEvent, payload: { id: string; title: string; content: string }) => {
      const note = addNote(payload)
      broadcastNoteChange()
      return note
    },
  )

  ipcMain.handle(
    'notes:update',
    (_event: IpcMainInvokeEvent, payload: { id: string; title?: string; content?: string }) => {
      const note = updateNote(payload)
      broadcastNoteChange()
      return note
    },
  )

  ipcMain.handle('notes:delete', (_event: IpcMainInvokeEvent, id: string) => {
    deleteNote(id)
    broadcastNoteChange()
    return { id }
  })
}
