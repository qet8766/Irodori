export type TaskCategory = 'short_term' | 'long_term' | 'project' | 'immediate'

export interface Task {
  id: string
  title: string
  description?: string
  category: TaskCategory
  isDone: boolean
  createdAt: number
  updatedAt: number
  isDeleted: boolean
}

export const CATEGORIES: { key: TaskCategory; title: string; color: string }[] = [
  { key: 'short_term', title: 'Short-term', color: '#06b6d4' },
  { key: 'long_term', title: 'Long-term', color: '#f59e0b' },
  { key: 'project', title: 'Projects', color: '#8b5cf6' },
  { key: 'immediate', title: 'Immediate', color: '#dc2626' },
]
