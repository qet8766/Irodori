import { ipcRenderer } from 'electron'

export type TranslyResultPayload = {
  input: string
  output: string
  pasted: boolean
  error?: string
  timing?: { totalMs: number; copyMs?: number; apiMs?: number; pasteMs?: number }
}

export type TranslateOptionsResultPayload = {
  input: string
  options: string[]
  error?: string
  timing?: { totalMs: number; apiMs?: number; clipboardMs?: number }
}

export const translyApi = {
  correctWord: (word: string, paste = true) =>
    ipcRenderer.invoke('transly:correct', { word, paste }) as Promise<TranslyResultPayload>,
}

export const translateOptionsApi = {
  select: (option: string) => ipcRenderer.send('translate-options:select', option),
  close: () => ipcRenderer.send('translate-options:close'),
}

export const onTranslyResult = (callback: (payload: TranslyResultPayload) => void) => {
  ipcRenderer.removeAllListeners('transly:result')
  ipcRenderer.on('transly:result', (_event, payload) => callback(payload))
}

export const onTranslateOptionsResult = (callback: (payload: TranslateOptionsResultPayload) => void) => {
  ipcRenderer.removeAllListeners('transly:options-result')
  ipcRenderer.on('transly:options-result', (_event, payload) => callback(payload))
}
