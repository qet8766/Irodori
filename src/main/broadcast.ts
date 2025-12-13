import type { BrowserWindow as BrowserWindowType } from 'electron'
import { BrowserWindow } from './electron'

export const CHANNELS = {
  TASKS_CHANGED: 'tasks:changed',
  NOTES_CHANGED: 'notes:changed',
  TRANSLY_RESULT: 'transly:result',
  TRANSLY_OPTIONS_RESULT: 'transly:options-result',
  AIRU_RESULT: 'airu:result',
  AIRU_PROMPTS_CHANGED: 'airu:prompts-changed',
} as const

export type BroadcastChannel = (typeof CHANNELS)[keyof typeof CHANNELS]

export const broadcast = <T>(channel: BroadcastChannel, payload?: T) => {
  BrowserWindow.getAllWindows().forEach((win: BrowserWindowType) => {
    win.webContents.send(channel, payload)
  })
}

export const broadcastTaskChange = () => broadcast(CHANNELS.TASKS_CHANGED)
export const broadcastNoteChange = () => broadcast(CHANNELS.NOTES_CHANGED)
export const broadcastAiruPromptsChange = () => broadcast(CHANNELS.AIRU_PROMPTS_CHANGED)
export const broadcastTranslyResult = <T>(result: T) => broadcast(CHANNELS.TRANSLY_RESULT, result)
export const broadcastTranslateOptionsResult = <T>(result: T) => broadcast(CHANNELS.TRANSLY_OPTIONS_RESULT, result)
export const broadcastAiruResult = <T>(result: T) => broadcast(CHANNELS.AIRU_RESULT, result)
