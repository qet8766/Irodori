import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import Database from 'better-sqlite3'
import { app } from '../electron'
import type { ProjectNote, Task, TaskCategory } from '@shared/types'

type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE'

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

let db: Database.Database | null = null
let syncHeartbeat: NodeJS.Timeout | null = null
const SQLITE_CLOUD_URL =
  'sqlitecloud://cueadayivk.g5.sqlite.cloud:8860/auth.sqlitecloud?apikey=0JQcewFfcdbetJA6rZKLiHRW6Z2SgiUqrYcH8f7fQPM'

const createTables = (database: Database.Database) => {
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

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      payload TEXT,
      timestamp INTEGER
    );
  `)
}

const probeSocket = (connectionString: string): Promise<boolean> =>
  new Promise((resolve) => {
    try {
      const parsed = new URL(connectionString)
      const port = Number(parsed.port) || 8860
      const socket = net.connect({ host: parsed.hostname, port, timeout: 3_000 }, () => {
        socket.end()
        resolve(true)
      })

      socket.on('error', () => resolve(false))
      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })
    } catch (error) {
      console.warn('[Irodori] Failed to parse SQLite Cloud URL', error)
      resolve(false)
    }
  })

export const verifySQLiteCloudConnection = async () => {
  const reachable = await probeSocket(SQLITE_CLOUD_URL)
  if (reachable) {
    console.info('[Irodori] SQLite Cloud endpoint reachable', SQLITE_CLOUD_URL)
  } else {
    console.warn('[Irodori] Unable to reach SQLite Cloud endpoint', SQLITE_CLOUD_URL)
  }
  return reachable
}

export const initDatabase = () => {
  if (db) return db

  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  const dbPath = path.join(userData, 'irodori.db')

  const instance = new Database(dbPath)
  instance.pragma('journal_mode = WAL')
  createTables(instance)

  db = instance
  void verifySQLiteCloudConnection()
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

const enqueueChange = (action: SyncAction, payload: Record<string, unknown>) => {
  const database = ensureDb()
  const insert = database.prepare(
    'INSERT INTO sync_queue (action, payload, timestamp) VALUES (@action, @payload, @timestamp)',
  )
  insert.run({
    action,
    payload: JSON.stringify(payload),
    timestamp: Date.now(),
  })
}

export const getTasks = (): Task[] => {
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

  enqueueChange('INSERT', row)
  return toTask(row)
}

export const updateTask = (payload: {
  id: string
  title?: string
  description?: string | null
  isDone?: boolean
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
    is_done: typeof payload.isDone === 'boolean' ? (payload.isDone ? 1 : 0) : existing.is_done,
    updated_at: Date.now(),
  }

  database
    .prepare(
      `UPDATE tasks
       SET title = @title,
           description = @description,
           is_done = @is_done,
           updated_at = @updated_at
       WHERE id = @id`,
    )
    .run(updated)

  enqueueChange('UPDATE', updated)
  return toTask(updated)
}

export const deleteTask = (id: string) => {
  const database = ensureDb()
  const updated_at = Date.now()
  database
    .prepare('UPDATE tasks SET is_deleted = 1, updated_at = @updated_at WHERE id = @id')
    .run({ id, updated_at })
  enqueueChange('DELETE', { id, updated_at })
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

  enqueueChange('INSERT', row)
  return toProjectNote(row)
}

export const deleteProjectNote = (id: string) => {
  const database = ensureDb()
  const updated_at = Date.now()
  database
    .prepare('UPDATE project_notes SET is_deleted = 1, updated_at = @updated_at WHERE id = @id')
    .run({ id, updated_at })
  enqueueChange('DELETE', { id, updated_at })
}

export const startSyncHeartbeat = () => {
  if (syncHeartbeat) return
  const database = ensureDb()
  syncHeartbeat = setInterval(() => {
    const pending = database.prepare('SELECT COUNT(*) AS count FROM sync_queue').get() as { count: number }
    if (pending?.count && process.env.NODE_ENV === 'development') {
      // Placeholder hook for future cloud sync; keeps the interval alive for now.
      console.debug(`[Irodori Sync] pending operations: ${pending.count}`)
    }
  }, 60_000)
}

export const stopSyncHeartbeat = () => {
  if (syncHeartbeat) {
    clearInterval(syncHeartbeat)
    syncHeartbeat = null
  }
}
