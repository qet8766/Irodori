import path from 'node:path'
import type { BrowserWindow as BrowserWindowType } from 'electron'
import { app, BrowserWindow, screen, globalShortcut } from './electron'
import type { TranslyResult, TranslateOptionsResult } from './transly'
import type { AiruResult } from '@shared/types'

type RendererTarget = {
  devServerUrl?: string
  indexHtml: string
}

let rendererTarget: RendererTarget | null = null
let launcherWindow: BrowserWindowType | null = null
let tooDooOverlay: BrowserWindowType | null = null
let quickAddWindow: BrowserWindowType | null = null
let translateOptionsWindow: BrowserWindowType | null = null
let noteTankOverlay: BrowserWindowType | null = null
let noteEditorWindow: BrowserWindowType | null = null
let airuPopupWindow: BrowserWindowType | null = null
let airuPromptEditorWindow: BrowserWindowType | null = null

export const configureRendererTarget = (target: RendererTarget) => {
  rendererTarget = target
}

const getPreloadPath = () => path.join(app.getAppPath(), 'dist-electron', 'preload.cjs')

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

const translyAccelerator = 'Alt+Shift+T'

export const registerTranslyShortcut = (runner: () => void | Promise<void>) => {
  if (globalShortcut.isRegistered(translyAccelerator)) globalShortcut.unregister(translyAccelerator)
  globalShortcut.register(translyAccelerator, () => {
    void runner()
  })
}

export const unregisterTranslyShortcut = () => {
  if (globalShortcut.isRegistered(translyAccelerator)) globalShortcut.unregister(translyAccelerator)
}

export const broadcastTranslyResult = (payload: TranslyResult) => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send('transly:result', payload)
  })
}

const translateOptionsAccelerator = 'Alt+Shift+K'

export const createTranslateOptionsWindow = (options: string[], input: string) => {
  const position = computePopupPosition(320, Math.min(40 + options.length * 36, 260))

  if (translateOptionsWindow) {
    translateOptionsWindow.close()
    translateOptionsWindow = null
  }

  const window = (translateOptionsWindow = new BrowserWindow({
    width: 320,
    height: Math.min(40 + options.length * 36, 260),
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

  window.on('blur', () => {
    window.close()
  })

  window.on('ready-to-show', () => {
    window.show()
    window.focus()
  })

  window.on('closed', () => {
    translateOptionsWindow = null
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const optionsQuery = encodeURIComponent(JSON.stringify(options))
  const inputQuery = encodeURIComponent(input)
  loadRoute(window, `/translate-options?options=${optionsQuery}&input=${inputQuery}`)

  return window
}

export const closeTranslateOptionsWindow = () => {
  translateOptionsWindow?.close()
}

export const registerTranslateOptionsShortcut = (runner: () => void | Promise<void>) => {
  if (globalShortcut.isRegistered(translateOptionsAccelerator)) globalShortcut.unregister(translateOptionsAccelerator)
  globalShortcut.register(translateOptionsAccelerator, () => {
    void runner()
  })
}

export const unregisterTranslateOptionsShortcut = () => {
  if (globalShortcut.isRegistered(translateOptionsAccelerator)) globalShortcut.unregister(translateOptionsAccelerator)
}

export const broadcastTranslateOptionsResult = (payload: TranslateOptionsResult) => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send('transly:options-result', payload)
  })
}

// --- NoteTank Window Management ---

const noteTankAccelerator = 'Alt+Shift+N'

export const createNoteTankOverlay = () => {
  if (noteTankOverlay) return noteTankOverlay

  const { width } = screen.getPrimaryDisplay().workAreaSize

  const window = (noteTankOverlay = new BrowserWindow({
    width: 360,
    height: 500,
    minWidth: 320,
    minHeight: 400,
    x: Math.max(width - 400, 32),
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
    noteTankOverlay = null
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  loadRoute(window, '/notetank')
  return window
}

export const closeNoteTankOverlay = () => {
  noteTankOverlay?.close()
}

export const createNoteEditorWindow = (noteId?: string) => {
  const position = computePopupPosition(400, 320)

  if (noteEditorWindow) {
    const route = noteId ? `/note-editor?id=${encodeURIComponent(noteId)}` : '/note-editor'
    loadRoute(noteEditorWindow, route)
    noteEditorWindow.setPosition(position.x, position.y)
    noteEditorWindow.show()
    noteEditorWindow.focus()
    return noteEditorWindow
  }

  const window = (noteEditorWindow = new BrowserWindow({
    width: 400,
    height: 320,
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
    noteEditorWindow = null
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const route = noteId ? `/note-editor?id=${encodeURIComponent(noteId)}` : '/note-editor'
  loadRoute(window, route)

  return window
}

export const closeNoteEditorWindow = () => {
  noteEditorWindow?.close()
}

export const registerNoteTankShortcut = (runner: () => void | Promise<void>) => {
  if (globalShortcut.isRegistered(noteTankAccelerator)) globalShortcut.unregister(noteTankAccelerator)
  globalShortcut.register(noteTankAccelerator, () => {
    void runner()
  })
}

export const unregisterNoteTankShortcut = () => {
  if (globalShortcut.isRegistered(noteTankAccelerator)) globalShortcut.unregister(noteTankAccelerator)
}

export const broadcastNoteChange = () => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send('notes:changed')
  })
}

// --- Airu Window Management ---

const airuAccelerator = 'Alt+Shift+A'

export const createAiruPopupWindow = () => {
  const position = computePopupPosition(360, 400)

  if (airuPopupWindow) {
    airuPopupWindow.setPosition(position.x, position.y)
    airuPopupWindow.show()
    airuPopupWindow.focus()
    loadRoute(airuPopupWindow, '/airu-popup')
    return airuPopupWindow
  }

  const window = (airuPopupWindow = new BrowserWindow({
    width: 360,
    height: 400,
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
    airuPopupWindow = null
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadRoute(window, '/airu-popup')

  return window
}

export const closeAiruPopupWindow = () => {
  airuPopupWindow?.close()
}

export const createAiruPromptEditorWindow = () => {
  const position = computePopupPosition(420, 480)

  if (airuPromptEditorWindow) {
    airuPromptEditorWindow.setPosition(position.x, position.y)
    airuPromptEditorWindow.show()
    airuPromptEditorWindow.focus()
    return airuPromptEditorWindow
  }

  const window = (airuPromptEditorWindow = new BrowserWindow({
    width: 420,
    height: 480,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
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
    airuPromptEditorWindow = null
  })

  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadRoute(window, '/airu-prompt-editor')

  return window
}

export const closeAiruPromptEditorWindow = () => {
  airuPromptEditorWindow?.close()
}

export const registerAiruShortcut = (runner: () => void | Promise<void>) => {
  if (globalShortcut.isRegistered(airuAccelerator)) globalShortcut.unregister(airuAccelerator)
  globalShortcut.register(airuAccelerator, () => {
    void runner()
  })
}

export const unregisterAiruShortcut = () => {
  if (globalShortcut.isRegistered(airuAccelerator)) globalShortcut.unregister(airuAccelerator)
}

export const broadcastAiruResult = (payload: AiruResult) => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send('airu:result', payload)
  })
}

export const broadcastAiruPromptsChange = () => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send('airu:prompts-changed')
  })
}
