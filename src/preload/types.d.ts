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
        ) => Promise<{
          input: string
          output: string
          pasted: boolean
          error?: string
          timing?: { totalMs: number; copyMs?: number; apiMs?: number; pasteMs?: number }
        }>
      }
      translateOptions: {
        select: (option: string) => void
        close: () => void
      }
      onTranslateOptionsResult: (callback: (payload: {
        input: string
        options: string[]
        error?: string
        timing?: { totalMs: number; apiMs?: number; clipboardMs?: number }
      }) => void) => void
      clipboard: {
        readText: () => string
        writeText: (text: string) => void
      }
      onTranslyResult: (callback: (payload: {
        input: string
        output: string
        pasted: boolean
        error?: string
        timing?: { totalMs: number; copyMs?: number; apiMs?: number; pasteMs?: number }
      }) => void) => void
    }
  }
}

export {}
