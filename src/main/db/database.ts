import fs from 'node:fs'
import path from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { Database as SQLiteCloudDatabase } from '@sqlitecloud/drivers'
import { app } from '../electron'
import type { ProjectNote, Task, TaskCategory } from '@shared/types'

type TaskRow = {
  id: string
  title: string
  description: string | null
  category: TaskCategory
  is_done: number
  created_at: number
  updated_at: number
  is_deleted: number
}

type ProjectNoteRow = {
  id: string
  task_id: string
  content: string
  created_at: number
  updated_at: number
  is_deleted: number
}

type CloudTaskRow = {
  id: string
  name: string
  description?: string | null
  section?: string | null
  created?: string | null
}

type CloudProjectItemRow = {
  id: string
  task_id: string
  text?: string | null
}

let db: BetterSqlite3.Database | null = null
let cloudDb: SQLiteCloudDatabase | null = null
const SQLITE_CLOUD_URL =
  'sqlitecloud://cueadayivk.g5.sqlite.cloud:8860/auth.sqlitecloud?apikey=0JQcewFfcdbetJA6rZKLiHRW6Z2SgiUqrYcH8f7fQPM'

const createTables = (database: BetterSqlite3.Database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      category TEXT,
      is_done INTEGER,
      created_at INTEGER,
      updated_at INTEGER,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS project_notes (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      content TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `)
}

export const initDatabase = () => {
  if (db) return db

  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  const dbPath = path.join(userData, 'irodori.db')

  const instance = new BetterSqlite3(dbPath)
  instance.pragma('journal_mode = WAL')
  createTables(instance)

  db = instance
  void verifySQLiteCloudConnection()
  void syncFromCloud()
  return instance
}

const ensureDb = () => {
  if (!db) throw new Error('Database not initialized')
  return db
}

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  category: row.category,
  isDone: Boolean(row.is_done),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isDeleted: Boolean(row.is_deleted),
})

const toProjectNote = (row: ProjectNoteRow): ProjectNote => ({
  id: row.id,
  taskId: row.task_id,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isDeleted: Boolean(row.is_deleted),
})

const parseCloudTimestamp = (value?: string | null) => {
  if (!value) return Date.now()
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

const normalizeCategory = (value?: string | null): TaskCategory =>
  value === 'long_term' || value === 'project' || value === 'immediate' ? value : 'short_term'

const closeCloudDb = async () => {
  if (!cloudDb) return
  try {
    cloudDb.close()
  } catch {
    // ignore close errors
  } finally {
    cloudDb = null
  }
}

const getCloudDb = async (): Promise<SQLiteCloudDatabase | null> => {
  if (cloudDb?.isConnected?.()) return cloudDb

  try {
    const instance = new SQLiteCloudDatabase(SQLITE_CLOUD_URL)
    await instance.sql('SELECT 1')
    cloudDb = instance
    return instance
  } catch (error) {
    console.warn('[Irodori] Unable to initialize SQLite Cloud connection', error)
    await closeCloudDb()
    return null
  }
}

export const verifySQLiteCloudConnection = async () => {
  const reachable = await getCloudDb()
  if (reachable) {
    console.info('[Irodori] SQLite Cloud endpoint reachable', SQLITE_CLOUD_URL)
    return true
  }

  console.warn('[Irodori] Unable to reach SQLite Cloud endpoint', SQLITE_CLOUD_URL)
  return false
}

const fetchCloudSnapshot = async () => {
  const client = await getCloudDb()
  if (!client) return null

  try {
    const [tasks, notes] = await Promise.all([
      client.sql('SELECT id, name, description, section, created FROM tasks'),
      client.sql('SELECT id, task_id, text FROM project_items'),
    ])

    return {
      tasks: Array.isArray(tasks) ? (tasks as CloudTaskRow[]) : [],
      notes: Array.isArray(notes) ? (notes as CloudProjectItemRow[]) : [],
    }
  } catch (error) {
    console.warn('[Irodori] Failed to fetch SQLite Cloud snapshot', error)
    await closeCloudDb()
    return null
  }
}

const syncFromCloud = async () => {
  const snapshot = await fetchCloudSnapshot()
  if (!snapshot) return false
  const database = ensureDb()
  const now = Date.now()

  const taskRows: TaskRow[] = snapshot.tasks.map((row) => {
    const createdAt = parseCloudTimestamp(row.created)
    return {
      id: row.id,
      title: row.name?.trim() || 'Untitled task',
      description: row.description?.trim() || null,
      category: normalizeCategory(row.section),
      is_done: 0,
      created_at: createdAt,
      updated_at: createdAt,
      is_deleted: 0,
    }
  })

  const noteRows: ProjectNoteRow[] = snapshot.notes.map((row) => ({
    id: row.id,
    task_id: row.task_id,
    content: (row.text ?? '').trim(),
    created_at: now,
    updated_at: now,
    is_deleted: 0,
  }))

  if (taskRows.length) {
    const upsertTask = database.prepare(
      `
        INSERT INTO tasks (id, title, description, category, is_done, created_at, updated_at, is_deleted)
        VALUES (@id, @title, @description, @category, @is_done, @created_at, @updated_at, @is_deleted)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          updated_at = MAX(tasks.updated_at, excluded.updated_at),
          is_deleted = 0
      `,
    )
    const upsertTasksTx = database.transaction((rows: TaskRow[]) => {
      rows.forEach((row) => upsertTask.run(row))
    })
    upsertTasksTx(taskRows)
  }

  if (noteRows.length) {
    const upsertNote = database.prepare(
      `
        INSERT INTO project_notes (id, task_id, content, created_at, updated_at, is_deleted)
        VALUES (@id, @task_id, @content, @created_at, @updated_at, @is_deleted)
        ON CONFLICT(id) DO UPDATE SET
          task_id = excluded.task_id,
          content = excluded.content,
          updated_at = excluded.updated_at,
          is_deleted = 0
      `,
    )
    const upsertNotesTx = database.transaction((rows: ProjectNoteRow[]) => {
      rows.forEach((row) => upsertNote.run(row))
    })
    upsertNotesTx(noteRows)
  }

  return true
}

const pushTaskToCloud = async (row: TaskRow) => {
  const client = await getCloudDb()
  if (!client) return

  try {
    await client.sql(
      'INSERT OR REPLACE INTO tasks (id, name, description, section, created) VALUES (?, ?, ?, ?, ?)',
      row.id,
      row.title,
      row.description ?? '',
      row.category,
      new Date(row.created_at).toISOString(),
    )
  } catch (error) {
    console.warn('[Irodori] Failed to push task to SQLite Cloud', error)
  }
}

const deleteTaskFromCloud = async (id: string) => {
  const client = await getCloudDb()
  if (!client) return

  try {
    await client.sql('DELETE FROM tasks WHERE id = ?', id)
  } catch (error) {
    console.warn('[Irodori] Failed to delete task from SQLite Cloud', error)
  }
}

const pushProjectNoteToCloud = async (row: ProjectNoteRow) => {
  const client = await getCloudDb()
  if (!client) return

  try {
    await client.sql('INSERT OR REPLACE INTO project_items (id, task_id, text) VALUES (?, ?, ?)', row.id, row.task_id, row.content)
  } catch (error) {
    console.warn('[Irodori] Failed to push project note to SQLite Cloud', error)
  }
}

const deleteProjectNoteFromCloud = async (id: string) => {
  const client = await getCloudDb()
  if (!client) return

  try {
    await client.sql('DELETE FROM project_items WHERE id = ?', id)
  } catch (error) {
    console.warn('[Irodori] Failed to delete project note from SQLite Cloud', error)
  }
}

const readLocalTasks = (): Task[] => {
  const database = ensureDb()
  const rows = database
    .prepare(
      `
        SELECT id, title, description, category, is_done, created_at, updated_at, is_deleted
        FROM tasks
        WHERE is_deleted = 0
        ORDER BY updated_at DESC
      `,
    )
    .all() as TaskRow[]

  const tasks = rows.map(toTask)

  const projectIds = tasks.filter((task) => task.category === 'project').map((task) => task.id)
  if (projectIds.length) {
    const placeholders = projectIds.map(() => '?').join(', ')
    const notes = database
      .prepare(
        `
          SELECT id, task_id, content, created_at, updated_at, is_deleted
          FROM project_notes
          WHERE is_deleted = 0 AND task_id IN (${placeholders})
          ORDER BY updated_at DESC
        `,
      )
      .all(...projectIds) as ProjectNoteRow[]

    const grouped = notes.reduce<Record<string, ProjectNote[]>>((acc, note) => {
      const collection = acc[note.task_id] ?? []
      collection.push(toProjectNote(note))
      acc[note.task_id] = collection
      return acc
    }, {})

    return tasks.map((task) =>
      task.category === 'project' ? { ...task, projectNotes: grouped[task.id] ?? [] } : task,
    )
  }

  return tasks
}

export const getTasks = async (): Promise<Task[]> => {
  await syncFromCloud()
  return readLocalTasks()
}

export const addTask = (payload: {
  id: string
  title: string
  description?: string
  category: TaskCategory
  isDone?: boolean
}): Task => {
  const database = ensureDb()
  const now = Date.now()
  const row: TaskRow = {
    id: payload.id,
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    category: payload.category,
    is_done: payload.isDone ? 1 : 0,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
  }

  database
    .prepare(
      `
        INSERT OR REPLACE INTO tasks (id, title, description, category, is_done, created_at, updated_at, is_deleted)
        VALUES (@id, @title, @description, @category, @is_done, @created_at, @updated_at, @is_deleted)
      `,
    )
    .run(row)

  void pushTaskToCloud(row)
  return toTask(row)
}

export const updateTask = (payload: {
  id: string
  title?: string
  description?: string | null
  isDone?: boolean
  category?: TaskCategory
}): Task | null => {
  const database = ensureDb()
  const existing = database
    .prepare(
      'SELECT id, title, description, category, is_done, created_at, updated_at, is_deleted FROM tasks WHERE id = ?',
    )
    .get(payload.id) as TaskRow | undefined

  if (!existing) return null

  const updated: TaskRow = {
    ...existing,
    title: typeof payload.title === 'string' ? payload.title.trim() : existing.title,
    description:
      payload.description === null
        ? null
        : typeof payload.description === 'string'
          ? payload.description.trim()
          : existing.description,
    category: payload.category ? normalizeCategory(payload.category) : existing.category,
    is_done: typeof payload.isDone === 'boolean' ? (payload.isDone ? 1 : 0) : existing.is_done,
    updated_at: Date.now(),
  }

  database
    .prepare(
      `UPDATE tasks
       SET title = @title,
           description = @description,
           category = @category,
           is_done = @is_done,
           updated_at = @updated_at
       WHERE id = @id`,
    )
    .run(updated)

  void pushTaskToCloud(updated)
  return toTask(updated)
}

export const deleteTask = (id: string) => {
  const database = ensureDb()
  const updated_at = Date.now()
  database
    .prepare('UPDATE tasks SET is_deleted = 1, updated_at = @updated_at WHERE id = @id')
    .run({ id, updated_at })
  void deleteTaskFromCloud(id)
}

export const addProjectNote = (payload: { id: string; taskId: string; content: string }): ProjectNote => {
  const database = ensureDb()
  const now = Date.now()
  const row: ProjectNoteRow = {
    id: payload.id,
    task_id: payload.taskId,
    content: payload.content.trim(),
    created_at: now,
    updated_at: now,
    is_deleted: 0,
  }

  database
    .prepare(
      `INSERT OR REPLACE INTO project_notes (id, task_id, content, created_at, updated_at, is_deleted)
       VALUES (@id, @task_id, @content, @created_at, @updated_at, @is_deleted)`,
    )
    .run(row)

  void pushProjectNoteToCloud(row)
  return toProjectNote(row)
}

export const deleteProjectNote = (id: string) => {
  const database = ensureDb()
  const updated_at = Date.now()
  database
    .prepare('UPDATE project_notes SET is_deleted = 1, updated_at = @updated_at WHERE id = @id')
    .run({ id, updated_at })
  void deleteProjectNoteFromCloud(id)
}
