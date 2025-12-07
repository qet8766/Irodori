import { ipcRenderer } from 'electron'
import type { Note } from '@shared/types'

export const notesApi = {
  list: () => ipcRenderer.invoke('notes:list') as Promise<Note[]>,

  add: (payload: { id: string; title: string; content: string }) =>
    ipcRenderer.invoke('notes:add', payload) as Promise<Note>,

  update: (payload: { id: string; title?: string; content?: string }) =>
    ipcRenderer.invoke('notes:update', payload) as Promise<Note | null>,

  remove: (id: string) => ipcRenderer.invoke('notes:delete', id) as Promise<{ id: string }>,
}

export const noteEditorApi = {
  open: (noteId?: string) => ipcRenderer.send('note-editor:open', noteId),
  close: () => ipcRenderer.send('note-editor:close'),
}

export const onNotesChanged = (callback: () => void) => {
  ipcRenderer.removeAllListeners('notes:changed')
  ipcRenderer.on('notes:changed', callback)
}
