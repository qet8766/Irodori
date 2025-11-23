import { contextBridge, ipcRenderer } from 'electron'
import type { Todo } from '@shared/types'

const api = {
  toggleTool: (tool: string, isActive: boolean) => ipcRenderer.send('toggle-tool', tool, isActive),
  todos: {
    list: () => ipcRenderer.invoke('todos:list') as Promise<Todo[]>,
    add: (payload: { id: string; content: string; isDone?: boolean }) =>
      ipcRenderer.invoke('todos:add', payload) as Promise<Todo>,
    toggle: (id: string, isDone?: boolean) =>
      ipcRenderer.invoke('todos:toggle', { id, isDone }) as Promise<Todo | null>,
    remove: (id: string) => ipcRenderer.invoke('todos:delete', id) as Promise<{ id: string }>,
  },
}

contextBridge.exposeInMainWorld('irodori', api)
