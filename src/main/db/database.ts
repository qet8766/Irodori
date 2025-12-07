import fs from 'node:fs'
import path from 'node:path'
import { app } from '../electron'
import type { Note, ProjectNote, Task, TaskCategory, AiruPrompt, AiruSettings } from '@shared/types'
import { DEFAULT_AIRU_SETTINGS } from '@shared/types'

// --- Types ---

type SyncQueueItem = {
  id: string
  table: string
  recordId: string
  operation: 'create' | 'update' | 'delete'
  payload: object | null
  createdAt: number
  retryCount: number
}

type LocalStore = {
  cache: {
    tasks: Task[]
    notes: Note[]
    airuPrompts: AiruPrompt[]
    lastSyncAt: number
  }
  syncQueue: SyncQueueItem[]
  settings: {
    apiUrl: string
    airuSettings: AiruSettings
  }
}

// --- Local Storage (JSON file) ---

let store: LocalStore | null = null
let storePath: string | null = null

const getDefaultStore = (): LocalStore => ({
  cache: {
    tasks: [],
    notes: [],
    airuPrompts: [],
    lastSyncAt: 0,
  },
  syncQueue: [],
  settings: {
    apiUrl: 'http://localhost:3456',
    airuSettings: { ...DEFAULT_AIRU_SETTINGS },
  },
})

const loadStore = (): LocalStore => {
  if (store) return store

  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  storePath = path.join(userData, 'irodori-store.json')

  try {
    if (fs.existsSync(storePath)) {
      const data = fs.readFileSync(storePath, 'utf-8')
      store = { ...getDefaultStore(), ...JSON.parse(data) }
    } else {
      store = getDefaultStore()
    }
  } catch (error) {
    console.warn('[Irodori] Failed to load store, using defaults:', error)
    store = getDefaultStore()
  }

  return store!
}

const saveStore = () => {
  if (!store || !storePath) return
  try {
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2))
  } catch (error) {
    console.warn('[Irodori] Failed to save store:', error)
  }
}

const ensureStore = () => {
  if (!store) loadStore()
  return store!
}

// --- API Client ---

const getApiUrl = () => ensureStore().settings.apiUrl

const apiFetch = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null }> => {
  try {
    const url = `${getApiUrl()}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { error?: string }
      return { data: null, error: errorData.error || `HTTP ${response.status}` }
    }

    const data = (await response.json()) as T
    return { data, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error'
    return { data: null, error: message }
  }
}

// --- Sync Queue Management ---

let isOnline = false
let syncInProgress = false
let syncInterval: ReturnType<typeof setInterval> | null = null

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const enqueueSync = (
  table: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete',
  payload: object | null,
) => {
  const s = ensureStore()

  // Remove existing operations for this record (coalesce)
  s.syncQueue = s.syncQueue.filter(
    (item) => !(item.table === table && item.recordId === recordId),
  )

  s.syncQueue.push({
    id: generateId(),
    table,
    recordId,
    operation,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  })

  saveStore()
  console.info(`[Irodori] Queued ${operation} for ${table}:${recordId}`)
}

const dequeueSync = (id: string) => {
  const s = ensureStore()
  s.syncQueue = s.syncQueue.filter((item) => item.id !== id)
  saveStore()
}

const incrementRetryCount = (id: string) => {
  const s = ensureStore()
  const item = s.syncQueue.find((i) => i.id === id)
  if (item) {
    item.retryCount++
    saveStore()
  }
}

export const getSyncQueueCount = (): number => {
  return ensureStore().syncQueue.length
}

export const getSyncStatus = (): { isOnline: boolean; pendingCount: number; lastSyncAt: number } => {
  const s = ensureStore()
  return {
    isOnline,
    pendingCount: s.syncQueue.length,
    lastSyncAt: s.cache.lastSyncAt,
  }
}

const checkOnlineStatus = async (): Promise<boolean> => {
  const { error } = await apiFetch('/api/health')
  isOnline = !error
  return isOnline
}

const processQueueItem = async (item: SyncQueueItem): Promise<boolean> => {
  let endpoint = ''
  let method = ''
  let body: string | undefined

  switch (item.table) {
    case 'tasks':
      if (item.operation === 'delete') {
        endpoint = `/api/tasks/${item.recordId}`
        method = 'DELETE'
      } else {
        endpoint = item.operation === 'create' ? '/api/tasks' : `/api/tasks/${item.recordId}`
        method = item.operation === 'create' ? 'POST' : 'PUT'
        body = JSON.stringify(item.payload)
      }
      break

    case 'project_notes':
      if (item.operation === 'delete') {
        endpoint = `/api/tasks/notes/${item.recordId}`
        method = 'DELETE'
      } else if (item.payload) {
        const notePayload = item.payload as { taskId: string }
        endpoint = `/api/tasks/${notePayload.taskId}/notes`
        method = 'POST'
        body = JSON.stringify(item.payload)
      }
      break

    case 'notes':
      if (item.operation === 'delete') {
        endpoint = `/api/notes/${item.recordId}`
        method = 'DELETE'
      } else {
        endpoint = item.operation === 'create' ? '/api/notes' : `/api/notes/${item.recordId}`
        method = item.operation === 'create' ? 'POST' : 'PUT'
        body = JSON.stringify(item.payload)
      }
      break

    case 'airu_prompts':
      if (item.operation === 'delete') {
        endpoint = `/api/airu/prompts/${item.recordId}`
        method = 'DELETE'
      } else {
        endpoint = item.operation === 'create' ? '/api/airu/prompts' : `/api/airu/prompts/${item.recordId}`
        method = item.operation === 'create' ? 'POST' : 'PUT'
        body = JSON.stringify(item.payload)
      }
      break

    default:
      console.warn(`[Irodori] Unknown table in sync queue: ${item.table}`)
      dequeueSync(item.id)
      return true
  }

  const { error } = await apiFetch(endpoint, { method, body })

  if (error) {
    console.warn(`[Irodori] Failed to sync ${item.table}:${item.recordId}:`, error)
    incrementRetryCount(item.id)
    return false
  }

  dequeueSync(item.id)
  console.info(`[Irodori] Synced ${item.operation} for ${item.table}:${item.recordId}`)
  return true
}

const syncFromServer = async () => {
  const s = ensureStore()

  // Fetch all data from server
  const [tasksRes, notesRes, promptsRes] = await Promise.all([
    apiFetch<Task[]>('/api/tasks'),
    apiFetch<Note[]>('/api/notes'),
    apiFetch<AiruPrompt[]>('/api/airu/prompts'),
  ])

  if (tasksRes.data) {
    s.cache.tasks = tasksRes.data
  }
  if (notesRes.data) {
    s.cache.notes = notesRes.data
  }
  if (promptsRes.data) {
    s.cache.airuPrompts = promptsRes.data
  }

  s.cache.lastSyncAt = Date.now()
  saveStore()

  console.info(`[Irodori] Synced from server - Tasks: ${tasksRes.data?.length ?? 0}, Notes: ${notesRes.data?.length ?? 0}, Prompts: ${promptsRes.data?.length ?? 0}`)
}

const processSyncQueue = async () => {
  if (syncInProgress) return
  syncInProgress = true

  try {
    const online = await checkOnlineStatus()
    if (!online) {
      console.info('[Irodori] Offline - skipping sync')
      return
    }

    // Pull latest from server
    await syncFromServer()

    // Process pending queue items
    const s = ensureStore()
    const pendingItems = s.syncQueue.filter((item) => item.retryCount < 5)

    if (pendingItems.length === 0) return

    console.info(`[Irodori] Processing ${pendingItems.length} queued items`)

    for (const item of pendingItems) {
      const success = await processQueueItem(item)
      if (!success) {
        const stillOnline = await checkOnlineStatus()
        if (!stillOnline) break
      }
    }
  } finally {
    syncInProgress = false
  }
}

export const startSyncScheduler = () => {
  if (syncInterval) return

  syncInterval = setInterval(() => {
    void processSyncQueue()
  }, 30000)

  // Initial sync
  void processSyncQueue()
  console.info(`[Irodori] Sync scheduler started - ${getSyncQueueCount()} items pending`)
}

export const stopSyncScheduler = () => {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
    console.info('[Irodori] Sync scheduler stopped')
  }
}

export const triggerSync = () => {
  void processSyncQueue()
}

// --- Database Initialization ---

export const initDatabase = () => {
  loadStore()
  startSyncScheduler()
  console.info('[Irodori] Database initialized (REST API mode)')
}

// --- API URL Settings ---

export const getApiUrlSetting = (): string => {
  return ensureStore().settings.apiUrl
}

export const setApiUrlSetting = (url: string) => {
  const s = ensureStore()
  s.settings.apiUrl = url
  saveStore()
  // Trigger sync with new URL
  void processSyncQueue()
}

// --- Tasks ---

export const getTasks = async (): Promise<Task[]> => {
  const s = ensureStore()

  // Try to sync from server
  if (await checkOnlineStatus()) {
    const { data } = await apiFetch<Task[]>('/api/tasks')
    if (data) {
      s.cache.tasks = data
      saveStore()
      return data
    }
  }

  // Return cached data if offline or error
  return s.cache.tasks
}

export const addTask = (payload: {
  id: string
  title: string
  description?: string
  category: TaskCategory
  isDone?: boolean
}): Task => {
  const s = ensureStore()
  const now = Date.now()

  const task: Task = {
    id: payload.id,
    title: payload.title.trim(),
    description: payload.description?.trim(),
    category: payload.category,
    isDone: payload.isDone || false,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }

  // Update local cache
  s.cache.tasks = [task, ...s.cache.tasks.filter((t) => t.id !== task.id)]
  saveStore()

  // Queue for sync
  enqueueSync('tasks', task.id, 'create', task)

  // Try immediate push
  void apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === task.id)?.id || '')
    }
  })

  return task
}

export const updateTask = (payload: {
  id: string
  title?: string
  description?: string | null
  isDone?: boolean
  category?: TaskCategory
}): Task | null => {
  const s = ensureStore()
  const existing = s.cache.tasks.find((t) => t.id === payload.id)
  if (!existing) return null

  const updated: Task = {
    ...existing,
    title: payload.title !== undefined ? payload.title.trim() : existing.title,
    description: payload.description === null ? undefined : (payload.description?.trim() ?? existing.description),
    category: payload.category ?? existing.category,
    isDone: payload.isDone ?? existing.isDone,
    updatedAt: Date.now(),
  }

  // Update local cache
  s.cache.tasks = s.cache.tasks.map((t) => (t.id === updated.id ? updated : t))
  saveStore()

  // Queue for sync
  enqueueSync('tasks', updated.id, 'update', updated)

  // Try immediate push
  void apiFetch(`/api/tasks/${updated.id}`, {
    method: 'PUT',
    body: JSON.stringify(updated),
  }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === updated.id)?.id || '')
    }
  })

  return updated
}

export const deleteTask = (id: string) => {
  const s = ensureStore()

  // Update local cache
  s.cache.tasks = s.cache.tasks.filter((t) => t.id !== id)
  saveStore()

  // Queue for sync
  enqueueSync('tasks', id, 'delete', null)

  // Try immediate push
  void apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === id)?.id || '')
    }
  })
}

// --- Project Notes ---

export const addProjectNote = (payload: { id: string; taskId: string; content: string }): ProjectNote => {
  const s = ensureStore()
  const now = Date.now()

  const note: ProjectNote = {
    id: payload.id,
    taskId: payload.taskId,
    content: payload.content.trim(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }

  // Update local cache - add to task's projectNotes
  s.cache.tasks = s.cache.tasks.map((t) => {
    if (t.id === payload.taskId) {
      return {
        ...t,
        projectNotes: [...(t.projectNotes || []), note],
      }
    }
    return t
  })
  saveStore()

  // Queue for sync
  enqueueSync('project_notes', note.id, 'create', note)

  // Try immediate push
  void apiFetch(`/api/tasks/${payload.taskId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ id: note.id, content: note.content }),
  }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === note.id)?.id || '')
    }
  })

  return note
}

export const deleteProjectNote = (id: string) => {
  const s = ensureStore()

  // Update local cache - remove from task's projectNotes
  s.cache.tasks = s.cache.tasks.map((t) => {
    if (t.projectNotes) {
      return {
        ...t,
        projectNotes: t.projectNotes.filter((n) => n.id !== id),
      }
    }
    return t
  })
  saveStore()

  // Queue for sync
  enqueueSync('project_notes', id, 'delete', null)

  // Try immediate push
  void apiFetch(`/api/tasks/notes/${id}`, { method: 'DELETE' }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === id)?.id || '')
    }
  })
}

// --- Notes (NoteTank) ---

export const getNotes = async (): Promise<Note[]> => {
  const s = ensureStore()

  if (await checkOnlineStatus()) {
    const { data } = await apiFetch<Note[]>('/api/notes')
    if (data) {
      s.cache.notes = data
      saveStore()
      return data
    }
  }

  return s.cache.notes
}

export const addNote = (payload: { id: string; title: string; content: string }): Note => {
  const s = ensureStore()
  const now = Date.now()

  const note: Note = {
    id: payload.id,
    title: payload.title.trim(),
    content: payload.content.trim(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }

  s.cache.notes = [note, ...s.cache.notes.filter((n) => n.id !== note.id)]
  saveStore()

  enqueueSync('notes', note.id, 'create', note)

  void apiFetch('/api/notes', {
    method: 'POST',
    body: JSON.stringify(note),
  }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === note.id)?.id || '')
    }
  })

  return note
}

export const updateNote = (payload: { id: string; title?: string; content?: string }): Note | null => {
  const s = ensureStore()
  const existing = s.cache.notes.find((n) => n.id === payload.id)
  if (!existing) return null

  const updated: Note = {
    ...existing,
    title: payload.title !== undefined ? payload.title.trim() : existing.title,
    content: payload.content !== undefined ? payload.content.trim() : existing.content,
    updatedAt: Date.now(),
  }

  s.cache.notes = s.cache.notes.map((n) => (n.id === updated.id ? updated : n))
  saveStore()

  enqueueSync('notes', updated.id, 'update', updated)

  void apiFetch(`/api/notes/${updated.id}`, {
    method: 'PUT',
    body: JSON.stringify(updated),
  }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === updated.id)?.id || '')
    }
  })

  return updated
}

export const deleteNote = (id: string) => {
  const s = ensureStore()

  s.cache.notes = s.cache.notes.filter((n) => n.id !== id)
  saveStore()

  enqueueSync('notes', id, 'delete', null)

  void apiFetch(`/api/notes/${id}`, { method: 'DELETE' }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === id)?.id || '')
    }
  })
}

// --- Airu Prompts ---

export const getAiruPrompts = async (): Promise<AiruPrompt[]> => {
  const s = ensureStore()

  if (await checkOnlineStatus()) {
    const { data } = await apiFetch<AiruPrompt[]>('/api/airu/prompts')
    if (data) {
      s.cache.airuPrompts = data
      saveStore()
      return data
    }
  }

  return s.cache.airuPrompts
}

export const addAiruPrompt = (payload: { id: string; title: string; content: string }): AiruPrompt => {
  const s = ensureStore()
  const now = Date.now()
  const maxOrder = Math.max(-1, ...s.cache.airuPrompts.map((p) => p.sortOrder))

  const prompt: AiruPrompt = {
    id: payload.id,
    title: payload.title.trim(),
    content: payload.content.trim(),
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  }

  s.cache.airuPrompts = [...s.cache.airuPrompts, prompt]
  saveStore()

  enqueueSync('airu_prompts', prompt.id, 'create', prompt)

  void apiFetch('/api/airu/prompts', {
    method: 'POST',
    body: JSON.stringify(prompt),
  }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === prompt.id)?.id || '')
    }
  })

  return prompt
}

export const updateAiruPrompt = (payload: {
  id: string
  title?: string
  content?: string
  sortOrder?: number
}): AiruPrompt | null => {
  const s = ensureStore()
  const existing = s.cache.airuPrompts.find((p) => p.id === payload.id)
  if (!existing) return null

  const updated: AiruPrompt = {
    ...existing,
    title: payload.title !== undefined ? payload.title.trim() : existing.title,
    content: payload.content !== undefined ? payload.content.trim() : existing.content,
    sortOrder: payload.sortOrder !== undefined ? payload.sortOrder : existing.sortOrder,
    updatedAt: Date.now(),
  }

  s.cache.airuPrompts = s.cache.airuPrompts.map((p) => (p.id === updated.id ? updated : p))
  saveStore()

  enqueueSync('airu_prompts', updated.id, 'update', updated)

  void apiFetch(`/api/airu/prompts/${updated.id}`, {
    method: 'PUT',
    body: JSON.stringify(updated),
  }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === updated.id)?.id || '')
    }
  })

  return updated
}

export const deleteAiruPrompt = (id: string) => {
  const s = ensureStore()

  s.cache.airuPrompts = s.cache.airuPrompts.filter((p) => p.id !== id)
  saveStore()

  enqueueSync('airu_prompts', id, 'delete', null)

  void apiFetch(`/api/airu/prompts/${id}`, { method: 'DELETE' }).then(({ error }) => {
    if (!error) {
      dequeueSync(s.syncQueue.find((i) => i.recordId === id)?.id || '')
    }
  })
}

export const reorderAiruPrompts = (orderedIds: string[]) => {
  const s = ensureStore()
  const now = Date.now()

  s.cache.airuPrompts = s.cache.airuPrompts.map((p) => {
    const newOrder = orderedIds.indexOf(p.id)
    if (newOrder !== -1) {
      return { ...p, sortOrder: newOrder, updatedAt: now }
    }
    return p
  }).sort((a, b) => a.sortOrder - b.sortOrder)

  saveStore()

  // Sync reorder to server
  void apiFetch('/api/airu/prompts/reorder', {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  })
}

// --- Airu Settings (Local Only) ---

export const getAiruSettings = (): AiruSettings => {
  return ensureStore().settings.airuSettings
}

export const setAiruSetting = (key: keyof AiruSettings, value: string | number) => {
  const s = ensureStore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(s.settings.airuSettings as any)[key] = value
  saveStore()
}

export const setAiruSettings = (settings: Partial<AiruSettings>) => {
  const s = ensureStore()
  s.settings.airuSettings = { ...s.settings.airuSettings, ...settings }
  saveStore()
}
