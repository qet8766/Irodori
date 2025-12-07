import { contextBridge, ipcRenderer, clipboard } from 'electron'
import { tasksApi, onTasksChanged } from './api/tasks.api'
import { notesApi, noteEditorApi, onNotesChanged } from './api/notes.api'
import { airuApi } from './api/airu.api'
import { translyApi, translateOptionsApi, onTranslyResult, onTranslateOptionsResult } from './api/transly.api'
import { settingsApi } from './api/settings.api'

const api = {
  // Tool toggle
  toggleTool: (tool: string, isActive: boolean) => ipcRenderer.send('toggle-tool', tool, isActive),

  // Tasks (TooDoo)
  tasks: tasksApi,
  onTasksChanged,

  // Notes (NoteTank)
  notes: notesApi,
  noteEditor: noteEditorApi,
  onNotesChanged,

  // Transly
  transly: translyApi,
  translateOptions: translateOptionsApi,
  onTranslyResult,
  onTranslateOptionsResult,

  // Airu
  airu: airuApi,

  // Settings
  settings: settingsApi,

  // Clipboard utilities
  clipboard: {
    readText: () => clipboard.readText(),
    writeText: (text: string) => clipboard.writeText(text ?? ''),
  },
}

contextBridge.exposeInMainWorld('irodori', api)
