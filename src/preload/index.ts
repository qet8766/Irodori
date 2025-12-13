import { contextBridge, ipcRenderer } from 'electron'
import type { Note, ProjectNote, Task, AiruPrompt, AiruResult, AiruSettings, AiruProvider } from '@shared/types'

// Tasks (TooDoo) API
const tasksApi = {
  list: () => ipcRenderer.invoke('tasks:list') as Promise<Task[]>,
  add: (payload: { id: string; title: string; description?: string; category: string; isDone?: boolean }) =>
    ipcRenderer.invoke('tasks:add', payload) as Promise<Task>,
  update: (payload: { id: string; title?: string; description?: string | null; isDone?: boolean; category?: string }) =>
    ipcRenderer.invoke('tasks:update', payload) as Promise<Task | null>,
  remove: (id: string) => ipcRenderer.invoke('tasks:delete', id) as Promise<{ id: string }>,
  addNote: (payload: { id: string; taskId: string; content: string }) =>
    ipcRenderer.invoke('tasks:note:add', payload) as Promise<ProjectNote>,
  removeNote: (id: string) => ipcRenderer.invoke('tasks:note:delete', id) as Promise<{ id: string }>,
}

// Notes (NoteTank) API
const notesApi = {
  list: () => ipcRenderer.invoke('notes:list') as Promise<Note[]>,
  add: (payload: { id: string; title: string; content: string }) =>
    ipcRenderer.invoke('notes:add', payload) as Promise<Note>,
  update: (payload: { id: string; title?: string; content?: string }) =>
    ipcRenderer.invoke('notes:update', payload) as Promise<Note | null>,
  remove: (id: string) => ipcRenderer.invoke('notes:delete', id) as Promise<{ id: string }>,
}

// Note Editor API
const noteEditorApi = {
  open: (noteId?: string) => ipcRenderer.send('note-editor:open', noteId),
  close: () => ipcRenderer.send('note-editor:close'),
}

// Translate Options API
const translateOptionsApi = {
  select: (option: string) => ipcRenderer.send('translate-options:select', option),
  close: () => ipcRenderer.send('translate-options:close'),
}

// Airu API
const airuApi = {
  prompts: {
    list: () => ipcRenderer.invoke('airu:prompts:list') as Promise<AiruPrompt[]>,
    add: (payload: { id: string; title: string; content: string }) =>
      ipcRenderer.invoke('airu:prompts:add', payload) as Promise<AiruPrompt>,
    update: (payload: { id: string; title?: string; content?: string; sortOrder?: number }) =>
      ipcRenderer.invoke('airu:prompts:update', payload) as Promise<AiruPrompt | null>,
    remove: (id: string) => ipcRenderer.invoke('airu:prompts:delete', id) as Promise<{ id: string }>,
    reorder: (orderedIds: string[]) => ipcRenderer.invoke('airu:prompts:reorder', orderedIds) as Promise<void>,
  },
  settings: {
    get: () => ipcRenderer.invoke('airu:settings:get') as Promise<AiruSettings>,
    set: (settings: Partial<AiruSettings>) => ipcRenderer.invoke('airu:settings:set', settings) as Promise<void>,
  },
  execute: (provider: AiruProvider, promptId: string, userInput: string) =>
    ipcRenderer.invoke('airu:execute', { provider, promptId, userInput }) as Promise<AiruResult>,
  paste: (text: string) => ipcRenderer.send('airu:paste', text),
  close: () => ipcRenderer.send('airu:close'),
  openPromptEditor: () => ipcRenderer.send('airu:open-prompt-editor'),
  closePromptEditor: () => ipcRenderer.send('airu:close-prompt-editor'),
  onResult: (callback: (payload: AiruResult) => void) => {
    ipcRenderer.removeAllListeners('airu:result')
    ipcRenderer.on('airu:result', (_event, payload) => callback(payload))
  },
  onPromptsChanged: (callback: () => void) => {
    ipcRenderer.removeAllListeners('airu:prompts-changed')
    ipcRenderer.on('airu:prompts-changed', callback)
  },
}

// Settings API
const settingsApi = {
  getApiUrl: () => ipcRenderer.invoke('settings:api-url:get') as Promise<string>,
  setApiUrl: (url: string) => ipcRenderer.invoke('settings:api-url:set', url) as Promise<void>,
  getSyncStatus: () =>
    ipcRenderer.invoke('settings:sync-status') as Promise<{ isOnline: boolean; pendingCount: number; lastSyncAt: number }>,
  triggerSync: () => ipcRenderer.invoke('settings:trigger-sync') as Promise<void>,
}

// IPC Event Listeners
const onTasksChanged = (callback: () => void) => {
  ipcRenderer.removeAllListeners('tasks:changed')
  ipcRenderer.on('tasks:changed', callback)
}

const onNotesChanged = (callback: () => void) => {
  ipcRenderer.removeAllListeners('notes:changed')
  ipcRenderer.on('notes:changed', callback)
}

const onTranslyResult = (
  callback: (payload: {
    input: string
    output: string
    pasted: boolean
    error?: string
    timing?: { totalMs: number; copyMs?: number; apiMs?: number; pasteMs?: number }
  }) => void,
) => {
  ipcRenderer.removeAllListeners('transly:result')
  ipcRenderer.on('transly:result', (_event, payload) => callback(payload))
}

const onTranslateOptionsResult = (
  callback: (payload: {
    input: string
    options: string[]
    error?: string
    timing?: { totalMs: number; apiMs?: number; clipboardMs?: number }
  }) => void,
) => {
  ipcRenderer.removeAllListeners('transly:options-result')
  ipcRenderer.on('transly:options-result', (_event, payload) => callback(payload))
}

// Exposed API
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

  // Transly (hotkey-driven; results are broadcast)
  translateOptions: translateOptionsApi,
  onTranslyResult,
  onTranslateOptionsResult,

  // Airu
  airu: airuApi,

  // Settings
  settings: settingsApi,
}

contextBridge.exposeInMainWorld('irodori', api)
