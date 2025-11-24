import { contextBridge, ipcRenderer, clipboard } from 'electron'
import type { ProjectNote, Task } from '@shared/types'

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
}

contextBridge.exposeInMainWorld('irodori', api)
