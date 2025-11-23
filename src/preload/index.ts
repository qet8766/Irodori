import { contextBridge, ipcRenderer } from 'electron'
import type { ProjectNote, Task } from '@shared/types'

const api = {
  toggleTool: (tool: string, isActive: boolean) => ipcRenderer.send('toggle-tool', tool, isActive),
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list') as Promise<Task[]>,
    add: (payload: { id: string; title: string; description?: string; category: string; isDone?: boolean }) =>
      ipcRenderer.invoke('tasks:add', payload) as Promise<Task>,
    update: (payload: { id: string; title?: string; description?: string | null; isDone?: boolean }) =>
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
  openQuickAdd: (category: string) => ipcRenderer.send('quick-add:open', category),
}

contextBridge.exposeInMainWorld('irodori', api)
