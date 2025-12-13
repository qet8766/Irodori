import path from 'node:path'
import fs from 'node:fs'

const DATA_DIR = process.env.DATA_DIR || './data'
fs.mkdirSync(DATA_DIR, { recursive: true })

const storePath = path.join(DATA_DIR, 'irodori-data.json')

const getDefaultStore = () => ({
  tasks: [],
  projectNotes: [],
  notes: [],
  airuPrompts: [],
})

let store = loadStore()

function loadStore() {
  try {
    if (!fs.existsSync(storePath)) return getDefaultStore()
    const raw = fs.readFileSync(storePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return { ...getDefaultStore(), ...parsed }
  } catch (error) {
    console.warn('[Store] Failed to load store, using defaults:', error)
    return getDefaultStore()
  }
}

function saveStore() {
  const tmpPath = `${storePath}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2))
  fs.renameSync(tmpPath, storePath)
}

const nowMs = () => Date.now()

// --- Tasks ---

export const getTasks = () => {
  const tasks = [...store.tasks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

  const notesByTask = new Map()
  for (const note of store.projectNotes) {
    if (!notesByTask.has(note.taskId)) notesByTask.set(note.taskId, [])
    notesByTask.get(note.taskId).push(note)
  }
  for (const list of notesByTask.values()) {
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  return tasks.map((task) => ({
    ...task,
    isDone: Boolean(task.isDone),
    isDeleted: false,
    projectNotes:
      task.category === 'project'
        ? (notesByTask.get(task.id) || []).map((n) => ({ ...n, isDeleted: false }))
        : undefined,
  }))
}

export const addTask = (task) => {
  if (store.tasks.some((t) => t.id === task.id)) {
    throw new Error('Task already exists')
  }

  const now = nowMs()
  const record = {
    id: task.id,
    title: String(task.title ?? '').trim(),
    description: task.description ? String(task.description).trim() : null,
    category: String(task.category ?? 'short_term'),
    isDone: Boolean(task.isDone),
    createdAt: now,
    updatedAt: now,
  }

  store.tasks.push(record)
  saveStore()
  return { ...record, isDeleted: false }
}

export const updateTask = (id, updates) => {
  const idx = store.tasks.findIndex((t) => t.id === id)
  if (idx === -1) return null

  const existing = store.tasks[idx]
  const now = nowMs()

  const updated = {
    ...existing,
    title: updates.title !== undefined ? String(updates.title).trim() : existing.title,
    description:
      updates.description !== undefined
        ? (updates.description ? String(updates.description).trim() : null)
        : existing.description,
    category: updates.category !== undefined ? String(updates.category) : existing.category,
    isDone: updates.isDone !== undefined ? Boolean(updates.isDone) : existing.isDone,
    updatedAt: now,
  }

  store.tasks[idx] = updated
  saveStore()
  return { ...updated, isDeleted: false }
}

export const deleteTask = (id) => {
  const before = store.tasks.length
  store.tasks = store.tasks.filter((t) => t.id !== id)
  if (store.tasks.length === before) return false

  store.projectNotes = store.projectNotes.filter((n) => n.taskId !== id)
  saveStore()
  return true
}

// --- Project Notes ---

export const addProjectNote = (note) => {
  if (store.projectNotes.some((n) => n.id === note.id)) {
    throw new Error('Project note already exists')
  }

  const now = nowMs()
  const record = {
    id: note.id,
    taskId: note.taskId,
    content: String(note.content ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  }

  store.projectNotes.push(record)
  saveStore()
  return { ...record, isDeleted: false }
}

export const deleteProjectNote = (id) => {
  const before = store.projectNotes.length
  store.projectNotes = store.projectNotes.filter((n) => n.id !== id)
  if (store.projectNotes.length === before) return false
  saveStore()
  return true
}

// --- Notes (NoteTank) ---

export const getNotes = () => {
  return [...store.notes]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map((n) => ({ ...n, isDeleted: false }))
}

export const addNote = (note) => {
  if (store.notes.some((n) => n.id === note.id)) {
    throw new Error('Note already exists')
  }

  const now = nowMs()
  const record = {
    id: note.id,
    title: String(note.title ?? '').trim(),
    content: String(note.content ?? ''),
    createdAt: now,
    updatedAt: now,
  }

  store.notes.push(record)
  saveStore()
  return { ...record, isDeleted: false }
}

export const updateNote = (id, updates) => {
  const idx = store.notes.findIndex((n) => n.id === id)
  if (idx === -1) return null

  const existing = store.notes[idx]
  const now = nowMs()
  const updated = {
    ...existing,
    title: updates.title !== undefined ? String(updates.title).trim() : existing.title,
    content: updates.content !== undefined ? String(updates.content) : existing.content,
    updatedAt: now,
  }

  store.notes[idx] = updated
  saveStore()
  return { ...updated, isDeleted: false }
}

export const deleteNote = (id) => {
  const before = store.notes.length
  store.notes = store.notes.filter((n) => n.id !== id)
  if (store.notes.length === before) return false
  saveStore()
  return true
}

// --- Airu Prompts ---

export const getAiruPrompts = () => {
  return [...store.airuPrompts]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((p) => ({ ...p, isDeleted: false }))
}

export const addAiruPrompt = (prompt) => {
  if (store.airuPrompts.some((p) => p.id === prompt.id)) {
    throw new Error('Prompt already exists')
  }

  const now = nowMs()
  const maxOrder = Math.max(-1, ...store.airuPrompts.map((p) => p.sortOrder ?? -1))
  const record = {
    id: prompt.id,
    title: String(prompt.title ?? '').trim(),
    content: String(prompt.content ?? ''),
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  }

  store.airuPrompts.push(record)
  saveStore()
  return { ...record, isDeleted: false }
}

export const updateAiruPrompt = (id, updates) => {
  const idx = store.airuPrompts.findIndex((p) => p.id === id)
  if (idx === -1) return null

  const existing = store.airuPrompts[idx]
  const now = nowMs()
  const updated = {
    ...existing,
    title: updates.title !== undefined ? String(updates.title).trim() : existing.title,
    content: updates.content !== undefined ? String(updates.content) : existing.content,
    sortOrder: updates.sortOrder !== undefined ? Number(updates.sortOrder) : existing.sortOrder,
    updatedAt: now,
  }

  store.airuPrompts[idx] = updated
  saveStore()
  return { ...updated, isDeleted: false }
}

export const deleteAiruPrompt = (id) => {
  const before = store.airuPrompts.length
  store.airuPrompts = store.airuPrompts.filter((p) => p.id !== id)
  if (store.airuPrompts.length === before) return false
  saveStore()
  return true
}

export const reorderAiruPrompts = (orderedIds) => {
  if (!Array.isArray(orderedIds)) return false
  const now = nowMs()

  const orderMap = new Map()
  orderedIds.forEach((id, index) => {
    orderMap.set(id, index)
  })

  store.airuPrompts = store.airuPrompts
    .map((p) =>
      orderMap.has(p.id)
        ? { ...p, sortOrder: orderMap.get(p.id), updatedAt: now }
        : p,
    )
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  saveStore()
  return true
}

console.log('[Store] Initialized at', storePath)
