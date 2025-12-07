import type { BrowserWindow as BrowserWindowType } from 'electron'
import { BrowserWindow } from '../../electron'
import { getPreloadPath, loadRoute, computeCursorPosition } from '../base'

let translateOptionsWindow: BrowserWindowType | null = null

export const createTranslateOptionsWindow = (options: string[], input: string): BrowserWindowType => {
  const height = Math.min(40 + options.length * 36, 260)
  const width = 320
  const position = computeCursorPosition(width, height)

  if (translateOptionsWindow) {
    translateOptionsWindow.close()
    translateOptionsWindow = null
  }

  const win = new BrowserWindow({
    width,
    height,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  translateOptionsWindow = win

  win.on('blur', () => {
    win.close()
  })

  win.on('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.on('closed', () => {
    translateOptionsWindow = null
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const optionsQuery = encodeURIComponent(JSON.stringify(options))
  const inputQuery = encodeURIComponent(input)
  loadRoute(win, `/translate-options?options=${optionsQuery}&input=${inputQuery}`)

  return win
}

export const getTranslateOptionsWindow = (): BrowserWindowType | null => translateOptionsWindow

export const closeTranslateOptionsWindow = () => {
  translateOptionsWindow?.close()
}
