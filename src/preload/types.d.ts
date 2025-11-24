import type { ProjectNote, Task } from '@shared/types'

declare global {
  interface Window {
    irodori: {
      toggleTool: (toolName: string, active: boolean) => void
      tasks: {
        list: () => Promise<Task[]>
        add: (payload: { id: string; title: string; description?: string; category: string; isDone?: boolean }) => Promise<Task>
        update: (payload: { id: string; title?: string; description?: string | null; isDone?: boolean; category?: string }) =>
          Promise<Task | null>
        remove: (id: string) => Promise<{ id: string }>
        addNote: (payload: { id: string; taskId: string; content: string }) => Promise<ProjectNote>
        removeNote: (id: string) => Promise<{ id: string }>
      }
      onTasksChanged: (callback: () => void) => void
      transly: {
        correctWord: (
          word: string,
          paste?: boolean,
        ) => Promise<{ input: string; output: string; pasted: boolean; error?: string }>
      }
      clipboard: {
        readText: () => string
        writeText: (text: string) => void
      }
      onTranslyResult: (callback: (payload: { input: string; output: string; pasted: boolean; error?: string }) => void) => void
    }
  }
}

export {}
