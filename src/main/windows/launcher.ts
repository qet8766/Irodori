import type { BrowserWindow as BrowserWindowType } from 'electron'
import { createWindow, type WindowConfig } from './base'

let launcherWindow: BrowserWindowType | null = null

const config: WindowConfig = {
  type: 'launcher',
  route: '/',
  width: 960,
  height: 700,
  minWidth: 760,
  minHeight: 560,
  title: 'Irodori',
}

export const createLauncherWindow = (): BrowserWindowType => {
  if (launcherWindow) return launcherWindow

  launcherWindow = createWindow(config)

  launcherWindow.on('closed', () => {
    launcherWindow = null
  })

  return launcherWindow
}

export const getLauncherWindow = (): BrowserWindowType | null => launcherWindow

export const closeLauncherWindow = () => {
  launcherWindow?.close()
}
