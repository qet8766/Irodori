import type { Note, ProjectNote, Task, AiruPrompt, AiruResult, AiruSettings, AiruProvider } from '@shared/types'

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
      onTranslyResult: (callback: (payload: {
        input: string
        output: string
        pasted: boolean
        error?: string
        timing?: { totalMs: number; copyMs?: number; apiMs?: number; pasteMs?: number }
      }) => void) => void
      notes: {
        list: () => Promise<Note[]>
        add: (payload: { id: string; title: string; content: string }) => Promise<Note>
        update: (payload: { id: string; title?: string; content?: string }) => Promise<Note | null>
        remove: (id: string) => Promise<{ id: string }>
      }
      noteEditor: {
        open: (noteId?: string) => void
        close: () => void
      }
      onNotesChanged: (callback: () => void) => void
      settings: {
        getApiUrl: () => Promise<string>
        setApiUrl: (url: string) => Promise<void>
        getSyncStatus: () => Promise<{ isOnline: boolean; pendingCount: number; lastSyncAt: number }>
        triggerSync: () => Promise<void>
      }
      airu: {
        prompts: {
          list: () => Promise<AiruPrompt[]>
          add: (payload: { id: string; title: string; content: string }) => Promise<AiruPrompt>
          update: (payload: { id: string; title?: string; content?: string; sortOrder?: number }) => Promise<AiruPrompt | null>
          remove: (id: string) => Promise<{ id: string }>
          reorder: (orderedIds: string[]) => Promise<void>
        }
        settings: {
          get: () => Promise<AiruSettings>
          set: (settings: Partial<AiruSettings>) => Promise<void>
        }
        execute: (provider: AiruProvider, promptId: string, userInput: string) => Promise<AiruResult>
        paste: (text: string) => void
        close: () => void
        openPromptEditor: () => void
        closePromptEditor: () => void
        onResult: (callback: (payload: AiruResult) => void) => void
        onPromptsChanged: (callback: () => void) => void
      }
    }
  }
}

export {}
