import { globalShortcut } from '../electron'

export type HotkeyAccelerator = string

export const registerHotkey = (accelerator: HotkeyAccelerator, runner: () => void | Promise<void>) => {
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator)
  }
  globalShortcut.register(accelerator, () => {
    void runner()
  })
}

export const unregisterHotkey = (accelerator: HotkeyAccelerator) => {
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator)
  }
}

export const isHotkeyRegistered = (accelerator: HotkeyAccelerator) => {
  return globalShortcut.isRegistered(accelerator)
}

// Irodori hotkey registry - central place to track all hotkeys
export const HOTKEYS = {
  // TooDoo
  TOODOO_SHORT_TERM: 'Alt+Shift+S',
  TOODOO_LONG_TERM: 'Alt+Shift+L',
  TOODOO_PROJECT: 'Alt+Shift+P',
  TOODOO_IMMEDIATE: 'Alt+Shift+I',
  // Transly
  TRANSLY_CORRECT: 'Alt+Shift+T',
  TRANSLY_OPTIONS: 'Alt+Shift+K',
  // NoteTank
  NOTETANK_EDITOR: 'Alt+Shift+N',
  // Airu
  AIRU_POPUP: 'Alt+Shift+A',
} as const

export type HotkeyName = keyof typeof HOTKEYS
