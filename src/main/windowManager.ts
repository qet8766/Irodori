import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow, screen } from './electron'

type RendererTarget = {
  devServerUrl?: string
  indexHtml: string
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let rendererTarget: RendererTarget | null = null
let launcherWindow: BrowserWindow | null = null
let tooDooOverlay: BrowserWindow | null = null

export const configureRendererTarget = (target: RendererTarget) => {
  rendererTarget = target
}

const getPreloadPath = () => path.join(__dirname, 'preload.cjs')

const loadRoute = (win: BrowserWindow, hashPath: string) => {
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

  launcherWindow = new BrowserWindow({
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
  })

  launcherWindow.on('closed', () => {
    launcherWindow = null
  })

  loadRoute(launcherWindow, '/')
  return launcherWindow
}

export const createTooDooOverlay = () => {
  if (tooDooOverlay) return tooDooOverlay

  const { width } = screen.getPrimaryDisplay().workAreaSize

  tooDooOverlay = new BrowserWindow({
    width: 340,
    height: 460,
    x: Math.max(width - 380, 32),
    y: 48,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    hasShadow: false,
    show: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  tooDooOverlay.on('closed', () => {
    tooDooOverlay = null
  })

  loadRoute(tooDooOverlay, '/toodoo')
  return tooDooOverlay
}

export const closeTooDooOverlay = () => {
  tooDooOverlay?.close()
}
