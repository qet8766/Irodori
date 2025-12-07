import type { BrowserWindow as BrowserWindowType } from 'electron'
import { createWindow, loadRoute, repositionWindow, type WindowConfig } from '../base'

let noteEditorWindow: BrowserWindowType | null = null

const config: WindowConfig = {
  type: 'popup',
  route: '/note-editor',
  width: 400,
  height: 320,
  position: 'cursor',
  resizable: false,
}

export const createNoteEditorWindow = (noteId?: string): BrowserWindowType => {
  const route = noteId ? `/note-editor?id=${encodeURIComponent(noteId)}` : '/note-editor'

  if (noteEditorWindow) {
    loadRoute(noteEditorWindow, route)
    repositionWindow(noteEditorWindow, config)
    noteEditorWindow.show()
    noteEditorWindow.focus()
    return noteEditorWindow
  }

  noteEditorWindow = createWindow({ ...config, route })

  noteEditorWindow.on('closed', () => {
    noteEditorWindow = null
  })

  return noteEditorWindow
}

export const getNoteEditorWindow = (): BrowserWindowType | null => noteEditorWindow

export const closeNoteEditorWindow = () => {
  noteEditorWindow?.close()
}
