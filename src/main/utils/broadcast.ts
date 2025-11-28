import type { BrowserWindow as BrowserWindowType } from 'electron'
import { BrowserWindow } from '../electron'

export const broadcast = (channel: string, ...args: unknown[]) => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send(channel, ...args)
  })
}

// Pre-defined broadcast channels
export const broadcastChannels = {
  TASKS_CHANGED: 'tasks:changed',
  NOTES_CHANGED: 'notes:changed',
  TRANSLY_RESULT: 'transly:result',
  TRANSLY_OPTIONS_RESULT: 'transly:options-result',
  AIRU_RESULT: 'airu:result',
  SETTINGS_CHANGED: 'settings:changed',
  PROMPTS_CHANGED: 'airu:prompts-changed',
} as const
