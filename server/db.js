import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DATA_DIR = process.env.DATA_DIR || './data'
fs.mkdirSync(DATA_DIR, { recursive: true })

const dbPath = path.join(DATA_DIR, 'irodori.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'short_term',
    is_done INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_notes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS airu_prompts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_project_notes_task ON project_notes(task_id);
  CREATE INDEX IF NOT EXISTS idx_airu_prompts_order ON airu_prompts(sort_order);
`)

console.log('[DB] Database initialized at', dbPath)

// --- Tasks ---

export const getTasks = () => {
  const tasks = db.prepare(`
    SELECT id, title, description, category, is_done as isDone, created_at as createdAt, updated_at as updatedAt
    FROM tasks
    ORDER BY updated_at DESC
  `).all()

  // Fetch project notes for project tasks
  const projectIds = tasks.filter(t => t.category === 'project').map(t => t.id)

  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(', ')
    const notes = db.prepare(`
      SELECT id, task_id as taskId, content, created_at as createdAt, updated_at as updatedAt
      FROM project_notes
      WHERE task_id IN (${placeholders})
      ORDER BY created_at DESC
    `).all(...projectIds)

    const notesByTask = {}
    for (const note of notes) {
      if (!notesByTask[note.taskId]) notesByTask[note.taskId] = []
      notesByTask[note.taskId].push(note)
    }

    return tasks.map(task => ({
      ...task,
      isDone: Boolean(task.isDone),
      projectNotes: task.category === 'project' ? (notesByTask[task.id] || []) : undefined
    }))
  }

  return tasks.map(task => ({ ...task, isDone: Boolean(task.isDone) }))
}

export const addTask = (task) => {
  const now = Date.now()
  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, description, category, is_done, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(task.id, task.title, task.description || null, task.category, task.isDone ? 1 : 0, now, now)

  return {
    id: task.id,
    title: task.title,
    description: task.description || null,
    category: task.category,
    isDone: task.isDone || false,
    createdAt: now,
    updatedAt: now
  }
}

export const updateTask = (id, updates) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!existing) return null

  const now = Date.now()
  const title = updates.title !== undefined ? updates.title : existing.title
  const description = updates.description !== undefined ? updates.description : existing.description
  const category = updates.category !== undefined ? updates.category : existing.category
  const isDone = updates.isDone !== undefined ? (updates.isDone ? 1 : 0) : existing.is_done

  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, category = ?, is_done = ?, updated_at = ?
    WHERE id = ?
  `).run(title, description, category, isDone, now, id)

  return {
    id,
    title,
    description,
    category,
    isDone: Boolean(isDone),
    createdAt: existing.created_at,
    updatedAt: now
  }
}

export const deleteTask = (id) => {
  // Delete associated project notes first
  db.prepare('DELETE FROM project_notes WHERE task_id = ?').run(id)
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return result.changes > 0
}

// --- Project Notes ---

export const addProjectNote = (note) => {
  const now = Date.now()
  db.prepare(`
    INSERT INTO project_notes (id, task_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(note.id, note.taskId, note.content, now, now)

  return {
    id: note.id,
    taskId: note.taskId,
    content: note.content,
    createdAt: now,
    updatedAt: now
  }
}

export const deleteProjectNote = (id) => {
  const result = db.prepare('DELETE FROM project_notes WHERE id = ?').run(id)
  return result.changes > 0
}

// --- Notes (NoteTank) ---

export const getNotes = () => {
  return db.prepare(`
    SELECT id, title, content, created_at as createdAt, updated_at as updatedAt
    FROM notes
    ORDER BY updated_at DESC
  `).all()
}

export const addNote = (note) => {
  const now = Date.now()
  db.prepare(`
    INSERT INTO notes (id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(note.id, note.title, note.content, now, now)

  return {
    id: note.id,
    title: note.title,
    content: note.content,
    createdAt: now,
    updatedAt: now
  }
}

export const updateNote = (id, updates) => {
  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id)
  if (!existing) return null

  const now = Date.now()
  const title = updates.title !== undefined ? updates.title : existing.title
  const content = updates.content !== undefined ? updates.content : existing.content

  db.prepare(`
    UPDATE notes SET title = ?, content = ?, updated_at = ?
    WHERE id = ?
  `).run(title, content, now, id)

  return {
    id,
    title,
    content,
    createdAt: existing.created_at,
    updatedAt: now
  }
}

export const deleteNote = (id) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  return result.changes > 0
}

// --- Airu Prompts ---

export const getAiruPrompts = () => {
  return db.prepare(`
    SELECT id, title, content, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt
    FROM airu_prompts
    ORDER BY sort_order ASC
  `).all()
}

export const addAiruPrompt = (prompt) => {
  const now = Date.now()
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM airu_prompts').get()
  const sortOrder = (maxOrder?.max ?? -1) + 1

  db.prepare(`
    INSERT INTO airu_prompts (id, title, content, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(prompt.id, prompt.title, prompt.content, sortOrder, now, now)

  return {
    id: prompt.id,
    title: prompt.title,
    content: prompt.content,
    sortOrder,
    createdAt: now,
    updatedAt: now
  }
}

export const updateAiruPrompt = (id, updates) => {
  const existing = db.prepare('SELECT * FROM airu_prompts WHERE id = ?').get(id)
  if (!existing) return null

  const now = Date.now()
  const title = updates.title !== undefined ? updates.title : existing.title
  const content = updates.content !== undefined ? updates.content : existing.content
  const sortOrder = updates.sortOrder !== undefined ? updates.sortOrder : existing.sort_order

  db.prepare(`
    UPDATE airu_prompts SET title = ?, content = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `).run(title, content, sortOrder, now, id)

  return {
    id,
    title,
    content,
    sortOrder,
    createdAt: existing.created_at,
    updatedAt: now
  }
}

export const deleteAiruPrompt = (id) => {
  const result = db.prepare('DELETE FROM airu_prompts WHERE id = ?').run(id)
  return result.changes > 0
}

export const reorderAiruPrompts = (orderedIds) => {
  const now = Date.now()
  const updateOrder = db.prepare('UPDATE airu_prompts SET sort_order = ?, updated_at = ? WHERE id = ?')

  const reorder = db.transaction((ids) => {
    ids.forEach((id, index) => {
      updateOrder.run(index, now, id)
    })
  })

  reorder(orderedIds)
  return true
}

export default db
