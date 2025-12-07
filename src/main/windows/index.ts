// Window factory and configuration
export { configureRendererTarget, loadRoute, getPreloadPath, createWindow } from './base'

// Launcher
export { createLauncherWindow, getLauncherWindow, closeLauncherWindow } from './launcher'

// Overlays
export { createTooDooOverlay, getTooDooOverlay, closeTooDooOverlay } from './overlays/toodoo'
export { createNoteTankOverlay, getNoteTankOverlay, closeNoteTankOverlay } from './overlays/notetank'

// Popups
export { createQuickAddWindow, getQuickAddWindow, closeQuickAddWindow } from './popups/quick-add'
export {
  createTranslateOptionsWindow,
  getTranslateOptionsWindow,
  closeTranslateOptionsWindow,
} from './popups/translate-options'
export { createNoteEditorWindow, getNoteEditorWindow, closeNoteEditorWindow } from './popups/note-editor'
export { createAiruPopupWindow, getAiruPopupWindow, closeAiruPopupWindow } from './popups/airu-popup'
export {
  createAiruPromptEditorWindow,
  getAiruPromptEditorWindow,
  closeAiruPromptEditorWindow,
} from './popups/airu-prompt-editor'
