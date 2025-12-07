import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { getApiUrlSetting, setApiUrlSetting, getSyncStatus, triggerSync } from '../db/database'

export const registerSettingsIpc = (ipcMain: IpcMain) => {
  ipcMain.handle('settings:api-url:get', () => getApiUrlSetting())

  ipcMain.handle('settings:api-url:set', (_event: IpcMainInvokeEvent, url: string) => {
    setApiUrlSetting(url)
  })

  ipcMain.handle('settings:sync-status', () => getSyncStatus())

  ipcMain.handle('settings:trigger-sync', () => {
    triggerSync()
  })
}
