import path from 'node:path'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import { app, BrowserWindow, screen } from '../electron'

type RendererTarget = {
  devServerUrl?: string
  indexHtml: string
}

let rendererTarget: RendererTarget | null = null

export const configureRendererTarget = (target: RendererTarget) => {
  rendererTarget = target
}

export const getPreloadPath = () => path.join(app.getAppPath(), 'dist-electron', 'preload.cjs')

export const loadRoute = (win: BrowserWindowType, hashPath: string) => {
  if (!rendererTarget) throw new Error('Renderer target not configured')
  const route = hashPath.startsWith('/') ? hashPath : `/${hashPath}`

  if (rendererTarget.devServerUrl) {
    const hash = route === '/' ? '#/' : `#${route}`
    win.loadURL(`${rendererTarget.devServerUrl}${hash}`)
    return
  }

  win.loadFile(rendererTarget.indexHtml, { hash: route })
}

export const computePopupPosition = (width: number, height: number) => {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x, y, width: areaWidth, height: areaHeight } = display.workArea
  const clampedX = Math.min(Math.max(cursor.x + 12, x), x + areaWidth - width - 8)
  const clampedY = Math.min(Math.max(cursor.y + 12, y), y + areaHeight - height - 8)

  return { x: Math.max(clampedX, x), y: Math.max(clampedY, y) }
}

export type PopupWindowOptions = {
  width: number
  height: number
  route: string
  transparent?: boolean
  resizable?: boolean
  closeOnBlur?: boolean
  onClosed?: () => void
}

export const createPopupWindow = (options: PopupWindowOptions): BrowserWindowType => {
  const position = computePopupPosition(options.width, options.height)

  const window = new BrowserWindow({
    width: options.width,
    height: options.height,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: options.transparent ?? true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: options.resizable ?? false,
    focusable: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.on('ready-to-show', () => {
    window.show()
    window.focus()
  })

  if (options.closeOnBlur) {
    window.on('blur', () => {
      window.close()
    })
  }

  if (options.onClosed) {
    window.on('closed', options.onClosed)
  }

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadRoute(window, options.route)

  return window
}

export type OverlayWindowOptions = {
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  route: string
  position?: { x: number; y: number }
  onClosed?: () => void
}

export const createOverlayWindow = (options: OverlayWindowOptions): BrowserWindowType => {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  const defaultPosition = { x: Math.max(width - options.width - 40, 32), y: 48 }
  const pos = options.position ?? defaultPosition

  const window = new BrowserWindow({
    width: options.width,
    height: options.height,
    minWidth: options.minWidth ?? options.width - 40,
    minHeight: options.minHeight ?? options.height - 60,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: true,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (options.onClosed) {
    window.on('closed', options.onClosed)
  }

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadRoute(window, options.route)

  return window
}
