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
  closeTooDooOverlay,
  configureRendererTarget,
  createLauncherWindow,
  createTooDooOverlay,
  createQuickAddWindow,
  registerQuickAddShortcuts,
  unregisterQuickAddShortcuts,
  broadcastTaskChange,
  registerTranslyShortcut,
  unregisterTranslyShortcut,
  broadcastTranslyResult,
  registerTranslateOptionsShortcut,
  unregisterTranslateOptionsShortcut,
  createTranslateOptionsWindow,
  closeTranslateOptionsWindow,
  broadcastTranslateOptionsResult,
  createNoteTankOverlay,
  closeNoteTankOverlay,
  createNoteEditorWindow,
  closeNoteEditorWindow,
  registerNoteTankShortcut,
  unregisterNoteTankShortcut,
  broadcastNoteChange,
  createAiruPopupWindow,
  closeAiruPopupWindow,
  createAiruPromptEditorWindow,
  closeAiruPromptEditorWindow,
  registerAiruShortcut,
  unregisterAiruShortcut,
  broadcastAiruResult,
  broadcastAiruPromptsChange,
} from './windowManager'
import { correctFromActiveSelection, translateOptions, pasteSelectedOption } from './transly'
import { executeAiruRequest } from './airu'
import { sendKeyboardCommand, sleep } from './utils/keyboard'

const devServerUrl =
  process.env.VITE_DEV_SERVER_URL || process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL || 'http://localhost:5173/'

const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')

const bootstrap = async () => {
  initDatabase()
  configureRendererTarget({ devServerUrl, indexHtml })
  createLauncherWindow()
  registerQuickAddShortcuts()
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
  unregisterTranslyShortcut()
  unregisterTranslateOptionsShortcut()
  unregisterNoteTankShortcut()
  unregisterAiruShortcut()
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
      registerTranslyShortcut(handleTranslyHotkey)
      registerTranslateOptionsShortcut(handleTranslateOptionsHotkey)
    } else {
      unregisterTranslyShortcut()
      unregisterTranslateOptionsShortcut()
    }
  } else if (toolName === 'NoteTank') {
    if (isActive) {
      createNoteTankOverlay()
      registerNoteTankShortcut(handleNoteTankHotkey)
    } else {
      closeNoteTankOverlay()
      unregisterNoteTankShortcut()
    }
  } else if (toolName === 'Airu') {
    if (isActive) {
      registerAiruShortcut(handleAiruHotkey)
    } else {
      unregisterAiruShortcut()
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