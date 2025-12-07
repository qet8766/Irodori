import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { clipboard } from '../electron'
import {
  getAiruPrompts,
  addAiruPrompt,
  updateAiruPrompt,
  deleteAiruPrompt,
  reorderAiruPrompts,
  getAiruSettings,
  setAiruSettings,
} from '../db/database'
import { broadcastAiruPromptsChange, broadcast, CHANNELS } from '../broadcast'
import { executeAiruRequest } from '../services/airu.service'
import { sendKeyboardCommand, sleep } from '../services/keyboard.service'
import {
  createAiruPromptEditorWindow,
  closeAiruPromptEditorWindow,
  closeAiruPopupWindow,
} from '../windows'
import type { AiruProvider, AiruSettings } from '@shared/types'

export const registerAiruIpc = (ipcMain: IpcMain) => {
  ipcMain.handle('airu:prompts:list', () => getAiruPrompts())

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
    (
      _event: IpcMainInvokeEvent,
      payload: { id: string; title?: string; content?: string; sortOrder?: number },
    ) => {
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

  ipcMain.handle('airu:settings:get', () => getAiruSettings())

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

      broadcast(CHANNELS.AIRU_RESULT, result)
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
}
