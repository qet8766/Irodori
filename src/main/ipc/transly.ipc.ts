import type { IpcMain, IpcMainEvent } from 'electron'
import { closeTranslateOptionsWindow } from '../windows'
import { pasteSelectedOption } from '../services/transly.service'

export const registerTranslyIpc = (ipcMain: IpcMain) => {
  ipcMain.on('translate-options:select', async (_event: IpcMainEvent, option: string) => {
    closeTranslateOptionsWindow()
    await pasteSelectedOption(option)
  })

  ipcMain.on('translate-options:close', () => {
    closeTranslateOptionsWindow()
  })
}
