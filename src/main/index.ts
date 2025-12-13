import path from 'node:path'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import {
  addProjectNote,
  addTask,
  deleteProjectNote,
  deleteTask,
  getTasks,
  initDatabase,
  updateTask,
  getNotes,
  addNote,
  updateNote,
  deleteNote,
  getAiruPrompts,
  addAiruPrompt,
  updateAiruPrompt,
  deleteAiruPrompt,
  reorderAiruPrompts,
  getAiruSettings,
  setAiruSettings,
} from './db/database'
import { app, BrowserWindow, ipcMain, clipboard } from './electron'
import type { TaskCategory, AiruProvider, AiruSettings } from '@shared/types'
import {
  configureRendererTarget,
  createLauncherWindow,
  createTooDooOverlay,
  closeTooDooOverlay,
  createNoteTankOverlay,
  closeNoteTankOverlay,
  createQuickAddWindow,
  createTranslateOptionsWindow,
  closeTranslateOptionsWindow,
  createNoteEditorWindow,
  closeNoteEditorWindow,
  createAiruPopupWindow,
  closeAiruPopupWindow,
  createAiruPromptEditorWindow,
  closeAiruPromptEditorWindow,
} from './windows'
import {
  correctFromActiveSelection,
  translateOptions,
  pasteSelectedOption,
  executeAiruRequest,
  sendKeyboardCommand,
  sleep,
} from './services'
import { registerShortcut, unregisterShortcut, TOODOO_CATEGORY_SHORTCUTS } from './shortcuts'
import {
  broadcastTaskChange,
  broadcastNoteChange,
  broadcastAiruPromptsChange,
  broadcastTranslyResult,
  broadcastTranslateOptionsResult,
  broadcastAiruResult,
} from './broadcast'
import { registerSettingsIpc } from './ipc/settings.ipc'

const devServerUrl =
  process.env.VITE_DEV_SERVER_URL || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || 'http://localhost:5173/'

const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')

const registerQuickAddShortcuts = () => {
  for (const [_accelerator, category] of Object.entries(TOODOO_CATEGORY_SHORTCUTS)) {
    const shortcutId = `toodoo:${category}` as const
    registerShortcut(shortcutId, () => {
      createQuickAddWindow(category)
    })
  }
}

const unregisterQuickAddShortcuts = () => {
  for (const [_accelerator, category] of Object.entries(TOODOO_CATEGORY_SHORTCUTS)) {
    const shortcutId = `toodoo:${category}` as const
    unregisterShortcut(shortcutId)
  }
}

const bootstrap = async () => {
  initDatabase()
  registerSettingsIpc(ipcMain)
  configureRendererTarget({ devServerUrl, indexHtml })
  createLauncherWindow()
  registerQuickAddShortcuts()
  // Activate all tools by default
  createTooDooOverlay()
  registerShortcut('transly:correct', handleTranslyHotkey)
  registerShortcut('transly:translate', handleTranslateOptionsHotkey)
  registerShortcut('notetank:editor', handleNoteTankHotkey) // Hotkey only, no overlay
  registerShortcut('airu:popup', handleAiruHotkey)
}

app.whenReady().then(bootstrap)

const handleTranslyHotkey = async () => {
  // This function now handles the entire Copy -> API -> Paste flow
  const result = await correctFromActiveSelection()
  if (result) {
    broadcastTranslyResult(result)
  }
}

const handleTranslateOptionsHotkey = async () => {
  const result = await translateOptions()
  broadcastTranslateOptionsResult(result)
  if (result.options.length > 0) {
    createTranslateOptionsWindow(result.options, result.input)
  }
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createLauncherWindow()
    registerQuickAddShortcuts()
  }
})

app.on('window-all-closed', () => {
  unregisterQuickAddShortcuts()
  unregisterShortcut('transly:correct')
  unregisterShortcut('transly:translate')
  unregisterShortcut('notetank:editor')
  unregisterShortcut('airu:popup')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

const handleNoteTankHotkey = () => {
  createNoteEditorWindow()
}

const handleAiruHotkey = () => {
  createAiruPopupWindow()
}

ipcMain.on('toggle-tool', (_event: IpcMainEvent, toolName: string, isActive: boolean) => {
  if (toolName === 'TooDoo') {
    isActive ? createTooDooOverlay() : closeTooDooOverlay()
  } else if (toolName === 'Transly') {
    if (isActive) {
      registerShortcut('transly:correct', handleTranslyHotkey)
      registerShortcut('transly:translate', handleTranslateOptionsHotkey)
    } else {
      unregisterShortcut('transly:correct')
      unregisterShortcut('transly:translate')
    }
  } else if (toolName === 'NoteTank') {
    // Hotkey is always registered at bootstrap, toggle only controls overlay visibility
    isActive ? createNoteTankOverlay() : closeNoteTankOverlay()
  } else if (toolName === 'Airu') {
    if (isActive) {
      registerShortcut('airu:popup', handleAiruHotkey)
    } else {
      unregisterShortcut('airu:popup')
    }
  }
})

// --- TooDoo Handlers ---
ipcMain.handle('tasks:list', (_event: IpcMainInvokeEvent) => getTasks())
ipcMain.handle(
  'tasks:add',
  (
    _event: IpcMainInvokeEvent,
    payload: { id: string; title: string; description?: string; category: TaskCategory; isDone?: boolean },
  ) => {
    const task = addTask(payload)
    broadcastTaskChange()
    return task
  },
)
ipcMain.handle(
  'tasks:update',
  (_event: IpcMainInvokeEvent, payload: { id: string; title?: string; description?: string | null; isDone?: boolean; category?: TaskCategory }) => {
    const task = updateTask(payload)
    broadcastTaskChange()
    return task
  },
)
ipcMain.handle('tasks:delete', (_event: IpcMainInvokeEvent, id: string) => {
  deleteTask(id)
  broadcastTaskChange()
  return { id }
})
ipcMain.handle('tasks:note:add', (_event: IpcMainInvokeEvent, payload: { id: string; taskId: string; content: string }) => {
  const note = addProjectNote(payload)
  broadcastTaskChange()
  return note
})
ipcMain.handle('tasks:note:delete', (_event: IpcMainInvokeEvent, id: string) => {
  deleteProjectNote(id)
  broadcastTaskChange()
  return { id }
})

ipcMain.on('quick-add:open', (_event: IpcMainEvent, category: string) => {
  createQuickAddWindow(category)
})

// --- Translate Options Handlers ---
ipcMain.on('translate-options:select', async (_event: IpcMainEvent, option: string) => {
  closeTranslateOptionsWindow()
  await pasteSelectedOption(option)
})

ipcMain.on('translate-options:close', () => {
  closeTranslateOptionsWindow()
})

// --- NoteTank Handlers ---
ipcMain.handle('notes:list', (_event: IpcMainInvokeEvent) => getNotes())
ipcMain.handle(
  'notes:add',
  (_event: IpcMainInvokeEvent, payload: { id: string; title: string; content: string }) => {
    const note = addNote(payload)
    broadcastNoteChange()
    return note
  },
)
ipcMain.handle(
  'notes:update',
  (_event: IpcMainInvokeEvent, payload: { id: string; title?: string; content?: string }) => {
    const note = updateNote(payload)
    broadcastNoteChange()
    return note
  },
)
ipcMain.handle('notes:delete', (_event: IpcMainInvokeEvent, id: string) => {
  deleteNote(id)
  broadcastNoteChange()
  return { id }
})

ipcMain.on('note-editor:open', (_event: IpcMainEvent, noteId?: string) => {
  createNoteEditorWindow(noteId)
})

ipcMain.on('note-editor:close', () => {
  closeNoteEditorWindow()
})

// --- Airu Handlers ---
ipcMain.handle('airu:prompts:list', (_event: IpcMainInvokeEvent) => getAiruPrompts())

ipcMain.handle(
  'airu:prompts:add',
  (_event: IpcMainInvokeEvent, payload: { id: string; title: string; content: string }) => {
    const prompt = addAiruPrompt(payload)
    broadcastAiruPromptsChange()
    return prompt
  },
)

ipcMain.handle(
  'airu:prompts:update',
  (_event: IpcMainInvokeEvent, payload: { id: string; title?: string; content?: string; sortOrder?: number }) => {
    const prompt = updateAiruPrompt(payload)
    broadcastAiruPromptsChange()
    return prompt
  },
)

ipcMain.handle('airu:prompts:delete', (_event: IpcMainInvokeEvent, id: string) => {
  deleteAiruPrompt(id)
  broadcastAiruPromptsChange()
  return { id }
})

ipcMain.handle('airu:prompts:reorder', (_event: IpcMainInvokeEvent, orderedIds: string[]) => {
  reorderAiruPrompts(orderedIds)
  broadcastAiruPromptsChange()
})

ipcMain.handle('airu:settings:get', (_event: IpcMainInvokeEvent) => getAiruSettings())

ipcMain.handle(
  'airu:settings:set',
  (_event: IpcMainInvokeEvent, settings: Partial<AiruSettings>) => {
    setAiruSettings(settings)
  },
)

ipcMain.handle(
  'airu:execute',
  async (
    _event: IpcMainInvokeEvent,
    payload: { provider: AiruProvider; promptId: string; userInput: string },
  ) => {
    // Get the prompt content
    const prompts = await getAiruPrompts()
    const prompt = prompts.find((p) => p.id === payload.promptId)

    if (!prompt) {
      return {
        provider: payload.provider,
        promptTitle: 'Unknown',
        promptContent: '',
        userInput: payload.userInput,
        fullRequest: '',
        response: '',
        error: 'Prompt not found',
      }
    }

    const result = await executeAiruRequest(
      payload.provider,
      prompt.title,
      prompt.content,
      payload.userInput,
    )

    broadcastAiruResult(result)
    return result
  },
)

ipcMain.on('airu:paste', async (_event: IpcMainEvent, text: string) => {
  closeAiruPopupWindow()
  clipboard.writeText(text)
  await sleep(60)
  await sendKeyboardCommand('V')
})

ipcMain.on('airu:close', () => {
  closeAiruPopupWindow()
})

ipcMain.on('airu:open-prompt-editor', () => {
  createAiruPromptEditorWindow()
})

ipcMain.on('airu:close-prompt-editor', () => {
  closeAiruPromptEditorWindow()
})