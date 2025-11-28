import { contextBridge, ipcRenderer, clipboard } from 'electron'
import type { Note, ProjectNote, Task, AiruPrompt, AiruResult, AiruSettings, AiruProvider } from '@shared/types'

const api = {
  toggleTool: (tool: string, isActive: boolean) => ipcRenderer.send('toggle-tool', tool, isActive),
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list') as Promise<Task[]>,
    add: (payload: { id: string; title: string; description?: string; category: string; isDone?: boolean }) =>
      ipcRenderer.invoke('tasks:add', payload) as Promise<Task>,
    update: (payload: { id: string; title?: string; description?: string | null; isDone?: boolean; category?: string }) =>
      ipcRenderer.invoke('tasks:update', payload) as Promise<Task | null>,
    remove: (id: string) => ipcRenderer.invoke('tasks:delete', id) as Promise<{ id: string }>,
    addNote: (payload: { id: string; taskId: string; content: string }) =>
      ipcRenderer.invoke('tasks:note:add', payload) as Promise<ProjectNote>,
    removeNote: (id: string) => ipcRenderer.invoke('tasks:note:delete', id) as Promise<{ id: string }>,
  },
  onTasksChanged: (callback: () => void) => {
    ipcRenderer.removeAllListeners('tasks:changed')
    ipcRenderer.on('tasks:changed', callback)
  },
  transly: {
    correctWord: (word: string, paste = true) =>
      ipcRenderer.invoke('transly:correct', { word, paste }) as Promise<{
        input: string
        output: string
        pasted: boolean
        error?: string
        timing?: { totalMs: number; copyMs?: number; apiMs?: number; pasteMs?: number }
      }>,
  },
  translateOptions: {
    select: (option: string) => ipcRenderer.send('translate-options:select', option),
    close: () => ipcRenderer.send('translate-options:close'),
  },
  onTranslateOptionsResult: (
    callback: (payload: {
      input: string
      options: string[]
      error?: string
      timing?: { totalMs: number; apiMs?: number; clipboardMs?: number }
    }) => void,
  ) => {
    ipcRenderer.removeAllListeners('transly:options-result')
    ipcRenderer.on('transly:options-result', (_event, payload) => callback(payload))
  },
  clipboard: {
    readText: () => clipboard.readText(),
    writeText: (text: string) => clipboard.writeText(text ?? ''),
  },
  onTranslyResult: (
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
  },
  // NoteTank API
  notes: {
    list: () => ipcRenderer.invoke('notes:list') as Promise<Note[]>,
    add: (payload: { id: string; title: string; content: string }) =>
      ipcRenderer.invoke('notes:add', payload) as Promise<Note>,
    update: (payload: { id: string; title?: string; content?: string }) =>
      ipcRenderer.invoke('notes:update', payload) as Promise<Note | null>,
    remove: (id: string) => ipcRenderer.invoke('notes:delete', id) as Promise<{ id: string }>,
  },
  noteEditor: {
    open: (noteId?: string) => ipcRenderer.send('note-editor:open', noteId),
    close: () => ipcRenderer.send('note-editor:close'),
  },
  onNotesChanged: (callback: () => void) => {
    ipcRenderer.removeAllListeners('notes:changed')
    ipcRenderer.on('notes:changed', callback)
  },
  // Airu API
  airu: {
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
  },
}

contextBridge.exposeInMainWorld('irodori', api)
