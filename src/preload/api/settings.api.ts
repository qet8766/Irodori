import { ipcRenderer } from 'electron'

export type SyncStatus = {
  isOnline: boolean
  pendingCount: number
  lastSyncAt: number
}

export const settingsApi = {
  getApiUrl: () => ipcRenderer.invoke('settings:api-url:get') as Promise<string>,
  setApiUrl: (url: string) => ipcRenderer.invoke('settings:api-url:set', url) as Promise<void>,
  getSyncStatus: () => ipcRenderer.invoke('settings:sync-status') as Promise<SyncStatus>,
  triggerSync: () => ipcRenderer.invoke('settings:trigger-sync') as Promise<void>,
}
