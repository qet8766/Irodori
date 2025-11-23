import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from '../electron'
import type { Todo } from '@shared/types'

type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE'
type TodoRow = {
  id: string
  content: string
  is_done: number
  created_at: number
  updated_at: number
  is_deleted: number
}

let db: Database.Database | null = null
let syncHeartbeat: NodeJS.Timeout | null = null

const createTables = (database: Database.Database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      content TEXT,
      is_done INTEGER,
      created_at INTEGER,
      updated_at INTEGER,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      payload TEXT,
      timestamp INTEGER
    );
  `)
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
  return instance
}

const ensureDb = () => {
  if (!db) throw new Error('Database not initialized')
  return db
}

const toTodo = (row: TodoRow): Todo => ({
  id: row.id,
  content: row.content,
  isDone: Boolean(row.is_done),
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

export const getTodos = (): Todo[] => {
  const database = ensureDb()
  const rows = database
    .prepare(
      `
        SELECT id, content, is_done, created_at, updated_at, is_deleted
        FROM todos
        WHERE is_deleted = 0
        ORDER BY updated_at DESC
      `,
    )
    .all() as TodoRow[]
  return rows.map(toTodo)
}

export const addTodo = (payload: { id: string; content: string; isDone?: boolean }): Todo => {
  const database = ensureDb()
  const now = Date.now()
  const cleanedContent = payload.content.trim()
  const row: TodoRow = {
    id: payload.id,
    content: cleanedContent,
    is_done: payload.isDone ? 1 : 0,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
  }

  database
    .prepare(
      `
        INSERT OR REPLACE INTO todos (id, content, is_done, created_at, updated_at, is_deleted)
        VALUES (@id, @content, @is_done, @created_at, @updated_at, @is_deleted)
      `,
    )
    .run(row)

  enqueueChange('INSERT', row)
  return toTodo(row)
}

export const toggleTodo = (id: string, forceState?: boolean): Todo | null => {
  const database = ensureDb()
  const existing = database
    .prepare('SELECT id, content, is_done, created_at, updated_at, is_deleted FROM todos WHERE id = ?')
    .get(id) as TodoRow | undefined

  if (!existing) return null

  const nextState = typeof forceState === 'boolean' ? forceState : !Boolean(existing.is_done)
  const updated_at = Date.now()

  database
    .prepare('UPDATE todos SET is_done = @is_done, updated_at = @updated_at WHERE id = @id')
    .run({ id, is_done: nextState ? 1 : 0, updated_at })

  const updated = {
    ...existing,
    is_done: nextState ? 1 : 0,
    updated_at,
  }

  enqueueChange('UPDATE', updated)
  return toTodo(updated)
}

export const deleteTodo = (id: string) => {
  const database = ensureDb()
  const updated_at = Date.now()
  database
    .prepare('UPDATE todos SET is_deleted = 1, updated_at = @updated_at WHERE id = @id')
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
