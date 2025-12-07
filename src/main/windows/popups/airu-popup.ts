import type { BrowserWindow as BrowserWindowType } from 'electron'
import { createWindow, loadRoute, repositionWindow, type WindowConfig } from '../base'

let airuPopupWindow: BrowserWindowType | null = null

const config: WindowConfig = {
  type: 'popup',
  route: '/airu-popup',
  width: 360,
  height: 400,
  position: 'cursor',
  resizable: false,
}

export const createAiruPopupWindow = (): BrowserWindowType => {
  if (airuPopupWindow) {
    repositionWindow(airuPopupWindow, config)
    airuPopupWindow.show()
    airuPopupWindow.focus()
    loadRoute(airuPopupWindow, '/airu-popup')
    return airuPopupWindow
  }

  airuPopupWindow = createWindow(config)

  airuPopupWindow.on('closed', () => {
    airuPopupWindow = null
  })

  return airuPopupWindow
}

export const getAiruPopupWindow = (): BrowserWindowType | null => airuPopupWindow

export const closeAiruPopupWindow = () => {
  airuPopupWindow?.close()
}
