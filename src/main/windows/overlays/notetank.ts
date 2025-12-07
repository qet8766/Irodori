import type { BrowserWindow as BrowserWindowType } from 'electron'
import { createWindow, type WindowConfig } from '../base'

let noteTankOverlay: BrowserWindowType | null = null

const config: WindowConfig = {
  type: 'overlay',
  route: '/notetank',
  width: 360,
  height: 500,
  minWidth: 320,
  minHeight: 400,
  position: 'screen-right',
  resizable: true,
}

export const createNoteTankOverlay = (): BrowserWindowType => {
  if (noteTankOverlay) return noteTankOverlay

  noteTankOverlay = createWindow(config)

  noteTankOverlay.on('closed', () => {
    noteTankOverlay = null
  })

  return noteTankOverlay
}

export const getNoteTankOverlay = (): BrowserWindowType | null => noteTankOverlay

export const closeNoteTankOverlay = () => {
  noteTankOverlay?.close()
}
