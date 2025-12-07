import type { BrowserWindow as BrowserWindowType } from 'electron'
import { createWindow, repositionWindow, type WindowConfig } from '../base'

let airuPromptEditorWindow: BrowserWindowType | null = null

const config: WindowConfig = {
  type: 'popup',
  route: '/airu-prompt-editor',
  width: 420,
  height: 480,
  position: 'cursor',
  resizable: true,
}

export const createAiruPromptEditorWindow = (): BrowserWindowType => {
  if (airuPromptEditorWindow) {
    repositionWindow(airuPromptEditorWindow, config)
    airuPromptEditorWindow.show()
    airuPromptEditorWindow.focus()
    return airuPromptEditorWindow
  }

  airuPromptEditorWindow = createWindow(config)

  airuPromptEditorWindow.on('closed', () => {
    airuPromptEditorWindow = null
  })

  return airuPromptEditorWindow
}

export const getAiruPromptEditorWindow = (): BrowserWindowType | null => airuPromptEditorWindow

export const closeAiruPromptEditorWindow = () => {
  airuPromptEditorWindow?.close()
}
