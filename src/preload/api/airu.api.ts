import { ipcRenderer } from 'electron'
import type { AiruPrompt, AiruResult, AiruSettings, AiruProvider } from '@shared/types'

export const airuPromptsApi = {
  list: () => ipcRenderer.invoke('airu:prompts:list') as Promise<AiruPrompt[]>,

  add: (payload: { id: string; title: string; content: string }) =>
    ipcRenderer.invoke('airu:prompts:add', payload) as Promise<AiruPrompt>,

  update: (payload: { id: string; title?: string; content?: string; sortOrder?: number }) =>
    ipcRenderer.invoke('airu:prompts:update', payload) as Promise<AiruPrompt | null>,

  remove: (id: string) => ipcRenderer.invoke('airu:prompts:delete', id) as Promise<{ id: string }>,

  reorder: (orderedIds: string[]) => ipcRenderer.invoke('airu:prompts:reorder', orderedIds) as Promise<void>,
}

export const airuSettingsApi = {
  get: () => ipcRenderer.invoke('airu:settings:get') as Promise<AiruSettings>,
  set: (settings: Partial<AiruSettings>) => ipcRenderer.invoke('airu:settings:set', settings) as Promise<void>,
}

export const airuApi = {
  prompts: airuPromptsApi,
  settings: airuSettingsApi,

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
