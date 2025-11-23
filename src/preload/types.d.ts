import type { Todo } from '@shared/types'

declare global {
  interface Window {
    irodori: {
      toggleTool: (toolName: string, active: boolean) => void
      todos: {
        list: () => Promise<Todo[]>
        add: (payload: { id: string; content: string; isDone?: boolean }) => Promise<Todo>
        toggle: (id: string, isDone?: boolean) => Promise<Todo | null>
        remove: (id: string) => Promise<{ id: string }>
      }
    }
  }
}

export {}
