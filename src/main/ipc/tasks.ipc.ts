import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
  addProjectNote,
  deleteProjectNote,
} from '../db/database'
import { broadcastTaskChange } from '../broadcast'
import type { TaskCategory } from '@shared/types'

export const registerTasksIpc = (ipcMain: IpcMain) => {
  ipcMain.handle('tasks:list', () => getTasks())

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
    (
      _event: IpcMainInvokeEvent,
      payload: { id: string; title?: string; description?: string | null; isDone?: boolean; category?: TaskCategory },
    ) => {
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

  ipcMain.handle(
    'tasks:note:add',
    (_event: IpcMainInvokeEvent, payload: { id: string; taskId: string; content: string }) => {
      const note = addProjectNote(payload)
      broadcastTaskChange()
      return note
    },
  )

  ipcMain.handle('tasks:note:delete', (_event: IpcMainInvokeEvent, id: string) => {
    deleteProjectNote(id)
    broadcastTaskChange()
    return { id }
  })
}
