import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import { BrowserWindow, screen, globalShortcut } from './electron'

type RendererTarget = {
  devServerUrl?: string
  indexHtml: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let rendererTarget: RendererTarget | null = null
let launcherWindow: BrowserWindowType | null = null
let tooDooOverlay: BrowserWindowType | null = null
let quickAddWindow: BrowserWindowType | null = null

export const configureRendererTarget = (target: RendererTarget) => {
  rendererTarget = target
}

const getPreloadPath = () => path.join(__dirname, 'preload.cjs')

const loadRoute = (win: BrowserWindowType, hashPath: string) => {
  if (!rendererTarget) throw new Error('Renderer target not configured')
  const route = hashPath.startsWith('/') ? hashPath : `/${hashPath}`

  if (rendererTarget.devServerUrl) {
    const hash = route === '/' ? '#/' : `#${route}`
    win.loadURL(`${rendererTarget.devServerUrl}${hash}`)
    return
  }

  win.loadFile(rendererTarget.indexHtml, { hash: route })
}

export const createLauncherWindow = () => {
  if (launcherWindow) return launcherWindow

  const window = (launcherWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 760,
    minHeight: 560,
    title: 'Irodori',
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }))

  window.on('closed', () => {
    launcherWindow = null
  })

  loadRoute(window, '/')
  return window
}

export const createTooDooOverlay = () => {
  if (tooDooOverlay) return tooDooOverlay

  const { width } = screen.getPrimaryDisplay().workAreaSize

  const window = (tooDooOverlay = new BrowserWindow({
    width: 340,
    height: 460,
    minWidth: 300,
    minHeight: 320,
    x: Math.max(width - 380, 32),
    y: 48,
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
  }))

  window.on('closed', () => {
    tooDooOverlay = null
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadRoute(window, '/toodoo')
  return window
}

export const closeTooDooOverlay = () => {
  tooDooOverlay?.close()
}

const computePopupPosition = (width: number, height: number) => {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x, y, width: areaWidth, height: areaHeight } = display.workArea
  const clampedX = Math.min(Math.max(cursor.x + 12, x), x + areaWidth - width - 8)
  const clampedY = Math.min(Math.max(cursor.y + 12, y), y + areaHeight - height - 8)

  return { x: Math.max(clampedX, x), y: Math.max(clampedY, y) }
}

export const createQuickAddWindow = (category: string) => {
  const categoryQuery = encodeURIComponent(category)
  const position = computePopupPosition(360, 240)

  if (quickAddWindow) {
    loadRoute(quickAddWindow, `/quick-add?category=${categoryQuery}`)
    quickAddWindow.setPosition(position.x, position.y)
    quickAddWindow.show()
    quickAddWindow.focus()
    return quickAddWindow
  }

  const window = (quickAddWindow = new BrowserWindow({
    width: 360,
    height: 240,
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
  }))

  window.on('ready-to-show', () => {
    window.show()
    window.focus()
  })

  window.on('closed', () => {
    quickAddWindow = null
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadRoute(window, `/quick-add?category=${categoryQuery}`)

  return window
}

export const registerQuickAddShortcuts = () => {
  const shortcuts: Record<string, string> = {
    'Alt+Shift+S': 'short_term',
    'Alt+Shift+L': 'long_term',
    'Alt+Shift+P': 'project',
    'Alt+Shift+I': 'immediate',
  }

  Object.entries(shortcuts).forEach(([accelerator, category]) => {
    if (globalShortcut.isRegistered(accelerator)) return
    globalShortcut.register(accelerator, () => createQuickAddWindow(category))
  })
}

export const unregisterQuickAddShortcuts = () => {
  globalShortcut.unregister('Alt+Shift+S')
  globalShortcut.unregister('Alt+Shift+L')
  globalShortcut.unregister('Alt+Shift+P')
  globalShortcut.unregister('Alt+Shift+I')
}

export const broadcastTaskChange = () => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send('tasks:changed')
  })
}
