export type TaskCategory = 'short_term' | 'long_term' | 'project' | 'immediate'

export interface ProjectNote {
  id: string
  taskId: string
  content: string
  createdAt: number
  updatedAt: number
  isDeleted: boolean
}

export interface Task {
  id: string
  title: string
  description?: string
  category: TaskCategory
  isDone: boolean
  createdAt: number
  updatedAt: number
  isDeleted: boolean
  projectNotes?: ProjectNote[]
}

// NoteTank types
export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  isDeleted: boolean
}

// Airu types
export type AiruProvider = 'openai' | 'gemini' | 'claude'

export interface AiruPrompt {
  id: string
  title: string
  content: string
  sortOrder: number
  createdAt: number
  updatedAt: number
  isDeleted: boolean
}

export interface AiruSettings {
  // OpenAI settings
  openaiApiKey?: string
  openaiModel: string
  openaiTemperature: number
  openaiMaxTokens: number
  openaiTopP: number
  openaiFrequencyPenalty: number
  openaiPresencePenalty: number
  // Gemini settings (placeholder)
  geminiApiKey?: string
  geminiModel: string
  // Claude settings (placeholder)
  claudeApiKey?: string
  claudeModel: string
}

export const DEFAULT_AIRU_SETTINGS: AiruSettings = {
  openaiModel: 'gpt-4o',
  openaiTemperature: 1,
  openaiMaxTokens: 4096,
  openaiTopP: 1,
  openaiFrequencyPenalty: 0,
  openaiPresencePenalty: 0,
  geminiModel: 'gemini-pro',
  claudeModel: 'claude-3-sonnet',
}

export type AiruResult = {
  provider: AiruProvider
  promptTitle: string
  promptContent: string
  userInput: string
  fullRequest: string
  response: string
  error?: string
  timing?: {
    totalMs: number
    apiMs?: number
  }
}
