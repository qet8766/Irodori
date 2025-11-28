import fs from 'node:fs'
import path from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { Database as SQLiteCloudDatabase } from '@sqlitecloud/drivers'
import { app } from '../electron'
import type { Note, ProjectNote, Task, TaskCategory, AiruPrompt, AiruSettings } from '@shared/types'
import { DEFAULT_AIRU_SETTINGS } from '@shared/types'

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

type NoteRow = {
  id: string
  title: string
  content: string
  created_at: number
  updated_at: number
  is_deleted: number
}

type AiruPromptRow = {
  id: string
  title: string
  content: string
  sort_order: number
  created_at: number
  updated_at: number
  is_deleted: number
}

type AiruSettingRow = {
  key: string
  value: string
}

type SyncQueueRow = {
  id: number
  table_name: string
  record_id: string
  operation: 'create' | 'update' | 'delete'
  payload: string | null
  created_at: number
  retry_count: number
}

type SyncMetaRow = {
  key: string
  value: string
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

type CloudNoteRow = {
  id: string
  title: string
  content?: string | null
  created?: string | null
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

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS airu_prompts (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      sort_order INTEGER,
      created_at INTEGER,
      updated_at INTEGER,
      is_deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS airu_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL,
      retry_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  // Migration: Add missing columns to sync_queue for existing databases
  const columns = database.prepare("PRAGMA table_info(sync_queue)").all() as { name: string }[]
  const columnNames = new Set(columns.map((col) => col.name))

  if (!columnNames.has('created_at')) {
    database.exec(`ALTER TABLE sync_queue ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`)
  }
  if (!columnNames.has('retry_count')) {
    database.exec(`ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER DEFAULT 0`)
  }

  // Create index after ensuring the column exists
  database.exec(`CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at)`)
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
  void ensureCloudNoteTankTable()
  void syncFromCloud()

  // Start the sync scheduler to process offline queue
  startSyncScheduler()

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

const toNote = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
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

// --- Sync Queue Management ---

let isOnline = true
let syncInProgress = false
let syncInterval: ReturnType<typeof setInterval> | null = null

const getSyncMeta = (key: string): string | null => {
  const database = ensureDb()
  const row = database.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key) as SyncMetaRow | undefined
  return row?.value ?? null
}

const setSyncMeta = (key: string, value: string) => {
  const database = ensureDb()
  database.prepare('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)').run(key, value)
}

const getLastSyncAt = (): number => {
  const value = getSyncMeta('last_sync_at')
  return value ? parseInt(value, 10) : 0
}

const setLastSyncAt = (timestamp: number) => {
  setSyncMeta('last_sync_at', String(timestamp))
}

const enqueueSync = (
  tableName: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete',
  payload?: object,
) => {
  const database = ensureDb()

  // Remove any existing pending operations for this record (coalesce)
  database.prepare('DELETE FROM sync_queue WHERE table_name = ? AND record_id = ?').run(tableName, recordId)

  // For delete operations, we don't need the payload
  // For create/update, store the full payload for retry
  database
    .prepare(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
    )
    .run(tableName, recordId, operation, payload ? JSON.stringify(payload) : null, Date.now())

  console.info(`[Irodori] Queued ${operation} for ${tableName}:${recordId}`)
}

const dequeueSync = (id: number) => {
  const database = ensureDb()
  database.prepare('DELETE FROM sync_queue WHERE id = ?').run(id)
}

const incrementRetryCount = (id: number) => {
  const database = ensureDb()
  database.prepare('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?').run(id)
}

const getPendingSyncItems = (): SyncQueueRow[] => {
  const database = ensureDb()
  return database
    .prepare('SELECT * FROM sync_queue WHERE retry_count < 5 ORDER BY created_at ASC')
    .all() as SyncQueueRow[]
}

export const getSyncQueueCount = (): number => {
  const database = ensureDb()
  const result = database.prepare('SELECT COUNT(*) as count FROM sync_queue').get() as { count: number }
  return result.count
}

export const getSyncStatus = (): { isOnline: boolean; pendingCount: number; lastSyncAt: number } => {
  return {
    isOnline,
    pendingCount: getSyncQueueCount(),
    lastSyncAt: getLastSyncAt(),
  }
}

const checkOnlineStatus = async (): Promise<boolean> => {
  try {
    const client = await getCloudDb()
    if (client) {
      isOnline = true
      return true
    }
  } catch {
    // Connection failed
  }
  isOnline = false
  return false
}

const processQueueItem = async (item: SyncQueueRow): Promise<boolean> => {
  const client = await getCloudDb()
  if (!client) return false

  try {
    const payload = item.payload ? JSON.parse(item.payload) : null

    switch (item.table_name) {
      case 'tasks':
        if (item.operation === 'delete') {
          await client.sql('DELETE FROM tasks WHERE id = ?', item.record_id)
        } else if (payload) {
          await client.sql(
            'INSERT OR REPLACE INTO tasks (id, name, description, section, created) VALUES (?, ?, ?, ?, ?)',
            payload.id,
            payload.title,
            payload.description ?? '',
            payload.category,
            new Date(payload.created_at).toISOString(),
          )
        }
        break

      case 'project_notes':
        if (item.operation === 'delete') {
          await client.sql('DELETE FROM project_items WHERE id = ?', item.record_id)
        } else if (payload) {
          await client.sql(
            'INSERT OR REPLACE INTO project_items (id, task_id, text) VALUES (?, ?, ?)',
            payload.id,
            payload.task_id,
            payload.content,
          )
        }
        break

      case 'notes':
        if (item.operation === 'delete') {
          await client.sql('DELETE FROM notetank WHERE id = ?', item.record_id)
        } else if (payload) {
          await client.sql(
            'INSERT OR REPLACE INTO notetank (id, title, content, created) VALUES (?, ?, ?, ?)',
            payload.id,
            payload.title,
            payload.content,
            new Date(payload.created_at).toISOString(),
          )
        }
        break

      case 'airu_prompts':
        if (item.operation === 'delete') {
          await client.sql('DELETE FROM airu_prompts WHERE id = ?', item.record_id)
        } else if (payload) {
          await ensureCloudAiruPromptsTable()
          await client.sql(
            'INSERT OR REPLACE INTO airu_prompts (id, title, content, sort_order, created) VALUES (?, ?, ?, ?, ?)',
            payload.id,
            payload.title,
            payload.content,
            payload.sort_order,
            new Date(payload.created_at).toISOString(),
          )
        }
        break
    }

    dequeueSync(item.id)
    console.info(`[Irodori] Synced ${item.operation} for ${item.table_name}:${item.record_id}`)
    return true
  } catch (error) {
    console.warn(`[Irodori] Failed to sync ${item.table_name}:${item.record_id}`, error)
    incrementRetryCount(item.id)
    return false
  }
}

const processSyncQueue = async () => {
  if (syncInProgress) return
  syncInProgress = true

  try {
    const online = await checkOnlineStatus()
    if (!online) {
      console.info('[Irodori] Offline - skipping sync queue processing')
      return
    }

    const items = getPendingSyncItems()
    if (items.length === 0) return

    console.info(`[Irodori] Processing ${items.length} queued sync items`)

    for (const item of items) {
      const success = await processQueueItem(item)
      if (!success) {
        // If we fail, connection might be lost - stop processing
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

  // Process queue every 30 seconds
  syncInterval = setInterval(() => {
    void processSyncQueue()
  }, 30000)

  // Also process immediately on start
  void processSyncQueue()
  console.info('[Irodori] Sync scheduler started')
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

// Helper to push with queue fallback
const pushWithQueue = async <T extends object>(
  tableName: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete',
  pushFn: () => Promise<void>,
  payload?: T,
) => {
  try {
    const client = await getCloudDb()
    if (!client) {
      // Offline - queue the operation
      enqueueSync(tableName, recordId, operation, payload)
      return
    }

    await pushFn()
  } catch (error) {
    console.warn(`[Irodori] Push failed for ${tableName}:${recordId}, queuing for retry`, error)
    enqueueSync(tableName, recordId, operation, payload)
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

const ensureCloudNoteTankTable = async () => {
  const client = await getCloudDb()
  if (!client) return false

  try {
    await client.sql(`
      CREATE TABLE IF NOT EXISTS notetank (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        created TEXT
      )
    `)
    console.info('[Irodori] NoteTank cloud table ensured')
    return true
  } catch (error) {
    console.warn('[Irodori] Failed to create NoteTank cloud table', error)
    return false
  }
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
  const syncStartTime = now

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

  // Update last sync timestamp
  setLastSyncAt(syncStartTime)
  console.info(`[Irodori] Cloud sync completed at ${new Date(syncStartTime).toISOString()}`)

  return true
}

const pushTaskToCloud = async (row: TaskRow) => {
  await pushWithQueue(
    'tasks',
    row.id,
    'update',
    async () => {
      const client = await getCloudDb()
      if (!client) throw new Error('No cloud connection')
      await client.sql(
        'INSERT OR REPLACE INTO tasks (id, name, description, section, created) VALUES (?, ?, ?, ?, ?)',
        row.id,
        row.title,
        row.description ?? '',
        row.category,
        new Date(row.created_at).toISOString(),
      )
    },
    row,
  )
}

const deleteTaskFromCloud = async (id: string) => {
  await pushWithQueue('tasks', id, 'delete', async () => {
    const client = await getCloudDb()
    if (!client) throw new Error('No cloud connection')
    await client.sql('DELETE FROM tasks WHERE id = ?', id)
  })
}

const pushProjectNoteToCloud = async (row: ProjectNoteRow) => {
  await pushWithQueue(
    'project_notes',
    row.id,
    'update',
    async () => {
      const client = await getCloudDb()
      if (!client) throw new Error('No cloud connection')
      await client.sql('INSERT OR REPLACE INTO project_items (id, task_id, text) VALUES (?, ?, ?)', row.id, row.task_id, row.content)
    },
    row,
  )
}

const deleteProjectNoteFromCloud = async (id: string) => {
  await pushWithQueue('project_notes', id, 'delete', async () => {
    const client = await getCloudDb()
    if (!client) throw new Error('No cloud connection')
    await client.sql('DELETE FROM project_items WHERE id = ?', id)
  })
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

// --- NoteTank Database Functions ---

const fetchCloudNoteTankSnapshot = async () => {
  const client = await getCloudDb()
  if (!client) return null

  try {
    // Ensure table exists before fetching
    await client.sql(`
      CREATE TABLE IF NOT EXISTS notetank (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        created TEXT
      )
    `)
    const notes = await client.sql('SELECT id, title, content, created FROM notetank')
    return Array.isArray(notes) ? (notes as CloudNoteRow[]) : []
  } catch (error) {
    console.warn('[Irodori] Failed to fetch NoteTank cloud snapshot', error)
    return null
  }
}

const syncNoteTankFromCloud = async () => {
  const cloudNotes = await fetchCloudNoteTankSnapshot()
  if (!cloudNotes) return false
  const database = ensureDb()

  const noteRows: NoteRow[] = cloudNotes.map((row) => {
    const createdAt = parseCloudTimestamp(row.created)
    return {
      id: row.id,
      title: row.title?.trim() || 'Untitled note',
      content: row.content?.trim() || '',
      created_at: createdAt,
      updated_at: createdAt,
      is_deleted: 0,
    }
  })

  if (noteRows.length) {
    const upsertNote = database.prepare(
      `
        INSERT INTO notes (id, title, content, created_at, updated_at, is_deleted)
        VALUES (@id, @title, @content, @created_at, @updated_at, @is_deleted)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updated_at = MAX(notes.updated_at, excluded.updated_at),
          is_deleted = 0
      `,
    )
    const upsertNotesTx = database.transaction((rows: NoteRow[]) => {
      rows.forEach((row) => upsertNote.run(row))
    })
    upsertNotesTx(noteRows)
  }

  return true
}

const pushNoteToCloud = async (row: NoteRow) => {
  await pushWithQueue(
    'notes',
    row.id,
    'update',
    async () => {
      const client = await getCloudDb()
      if (!client) throw new Error('No cloud connection')
      await client.sql(
        'INSERT OR REPLACE INTO notetank (id, title, content, created) VALUES (?, ?, ?, ?)',
        row.id,
        row.title,
        row.content,
        new Date(row.created_at).toISOString(),
      )
    },
    row,
  )
}

const deleteNoteFromCloud = async (id: string) => {
  await pushWithQueue('notes', id, 'delete', async () => {
    const client = await getCloudDb()
    if (!client) throw new Error('No cloud connection')
    await client.sql('DELETE FROM notetank WHERE id = ?', id)
  })
}

const readLocalNotes = (): Note[] => {
  const database = ensureDb()
  const rows = database
    .prepare(
      `
        SELECT id, title, content, created_at, updated_at, is_deleted
        FROM notes
        WHERE is_deleted = 0
        ORDER BY updated_at DESC
      `,
    )
    .all() as NoteRow[]

  return rows.map(toNote)
}

export const getNotes = async (): Promise<Note[]> => {
  await syncNoteTankFromCloud()
  return readLocalNotes()
}

export const addNote = (payload: { id: string; title: string; content: string }): Note => {
  const database = ensureDb()
  const now = Date.now()
  const row: NoteRow = {
    id: payload.id,
    title: payload.title.trim(),
    content: payload.content.trim(),
    created_at: now,
    updated_at: now,
    is_deleted: 0,
  }

  database
    .prepare(
      `
        INSERT OR REPLACE INTO notes (id, title, content, created_at, updated_at, is_deleted)
        VALUES (@id, @title, @content, @created_at, @updated_at, @is_deleted)
      `,
    )
    .run(row)

  void pushNoteToCloud(row)
  return toNote(row)
}

export const updateNote = (payload: {
  id: string
  title?: string
  content?: string
}): Note | null => {
  const database = ensureDb()
  const existing = database
    .prepare('SELECT id, title, content, created_at, updated_at, is_deleted FROM notes WHERE id = ?')
    .get(payload.id) as NoteRow | undefined

  if (!existing) return null

  const updated: NoteRow = {
    ...existing,
    title: typeof payload.title === 'string' ? payload.title.trim() : existing.title,
    content: typeof payload.content === 'string' ? payload.content.trim() : existing.content,
    updated_at: Date.now(),
  }

  database
    .prepare(
      `UPDATE notes
       SET title = @title,
           content = @content,
           updated_at = @updated_at
       WHERE id = @id`,
    )
    .run(updated)

  void pushNoteToCloud(updated)
  return toNote(updated)
}

export const deleteNote = (id: string) => {
  const database = ensureDb()
  const updated_at = Date.now()
  database
    .prepare('UPDATE notes SET is_deleted = 1, updated_at = @updated_at WHERE id = @id')
    .run({ id, updated_at })
  void deleteNoteFromCloud(id)
}

// --- Airu Database Functions ---

const toAiruPrompt = (row: AiruPromptRow): AiruPrompt => ({
  id: row.id,
  title: row.title,
  content: row.content,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isDeleted: Boolean(row.is_deleted),
})

// Cloud sync for Airu prompts
const ensureCloudAiruPromptsTable = async () => {
  const client = await getCloudDb()
  if (!client) return false

  try {
    await client.sql(`
      CREATE TABLE IF NOT EXISTS airu_prompts (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        sort_order INTEGER,
        created TEXT
      )
    `)
    console.info('[Irodori] Airu prompts cloud table ensured')
    return true
  } catch (error) {
    console.warn('[Irodori] Failed to create Airu prompts cloud table', error)
    return false
  }
}

type CloudAiruPromptRow = {
  id: string
  title: string
  content?: string | null
  sort_order?: number | null
  created?: string | null
}

const fetchCloudAiruPromptsSnapshot = async () => {
  const client = await getCloudDb()
  if (!client) return null

  try {
    await ensureCloudAiruPromptsTable()
    const prompts = await client.sql('SELECT id, title, content, sort_order, created FROM airu_prompts')
    return Array.isArray(prompts) ? (prompts as CloudAiruPromptRow[]) : []
  } catch (error) {
    console.warn('[Irodori] Failed to fetch Airu prompts cloud snapshot', error)
    return null
  }
}

const syncAiruPromptsFromCloud = async () => {
  const cloudPrompts = await fetchCloudAiruPromptsSnapshot()
  if (!cloudPrompts) return false
  const database = ensureDb()

  const promptRows: AiruPromptRow[] = cloudPrompts.map((row, idx) => {
    const createdAt = parseCloudTimestamp(row.created)
    return {
      id: row.id,
      title: row.title?.trim() || 'Untitled prompt',
      content: row.content?.trim() || '',
      sort_order: row.sort_order ?? idx,
      created_at: createdAt,
      updated_at: createdAt,
      is_deleted: 0,
    }
  })

  if (promptRows.length) {
    const upsertPrompt = database.prepare(
      `
        INSERT INTO airu_prompts (id, title, content, sort_order, created_at, updated_at, is_deleted)
        VALUES (@id, @title, @content, @sort_order, @created_at, @updated_at, @is_deleted)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          sort_order = excluded.sort_order,
          updated_at = MAX(airu_prompts.updated_at, excluded.updated_at),
          is_deleted = 0
      `,
    )
    const upsertPromptsTx = database.transaction((rows: AiruPromptRow[]) => {
      rows.forEach((row) => upsertPrompt.run(row))
    })
    upsertPromptsTx(promptRows)
  }

  return true
}

const pushAiruPromptToCloud = async (row: AiruPromptRow) => {
  await pushWithQueue(
    'airu_prompts',
    row.id,
    'update',
    async () => {
      const client = await getCloudDb()
      if (!client) throw new Error('No cloud connection')
      await ensureCloudAiruPromptsTable()
      await client.sql(
        'INSERT OR REPLACE INTO airu_prompts (id, title, content, sort_order, created) VALUES (?, ?, ?, ?, ?)',
        row.id,
        row.title,
        row.content,
        row.sort_order,
        new Date(row.created_at).toISOString(),
      )
    },
    row,
  )
}

const deleteAiruPromptFromCloud = async (id: string) => {
  await pushWithQueue('airu_prompts', id, 'delete', async () => {
    const client = await getCloudDb()
    if (!client) throw new Error('No cloud connection')
    await client.sql('DELETE FROM airu_prompts WHERE id = ?', id)
  })
}

export const getAiruPrompts = async (): Promise<AiruPrompt[]> => {
  await syncAiruPromptsFromCloud()
  const database = ensureDb()
  const rows = database
    .prepare(
      `
        SELECT id, title, content, sort_order, created_at, updated_at, is_deleted
        FROM airu_prompts
        WHERE is_deleted = 0
        ORDER BY sort_order ASC
      `,
    )
    .all() as AiruPromptRow[]

  return rows.map(toAiruPrompt)
}

export const addAiruPrompt = (payload: { id: string; title: string; content: string }): AiruPrompt => {
  const database = ensureDb()
  const now = Date.now()

  // Get the max sort_order
  const maxOrder = database.prepare('SELECT MAX(sort_order) as max FROM airu_prompts WHERE is_deleted = 0').get() as { max: number | null }
  const sortOrder = (maxOrder?.max ?? -1) + 1

  const row: AiruPromptRow = {
    id: payload.id,
    title: payload.title.trim(),
    content: payload.content.trim(),
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
  }

  database
    .prepare(
      `
        INSERT OR REPLACE INTO airu_prompts (id, title, content, sort_order, created_at, updated_at, is_deleted)
        VALUES (@id, @title, @content, @sort_order, @created_at, @updated_at, @is_deleted)
      `,
    )
    .run(row)

  void pushAiruPromptToCloud(row)
  return toAiruPrompt(row)
}

export const updateAiruPrompt = (payload: {
  id: string
  title?: string
  content?: string
  sortOrder?: number
}): AiruPrompt | null => {
  const database = ensureDb()
  const existing = database
    .prepare('SELECT id, title, content, sort_order, created_at, updated_at, is_deleted FROM airu_prompts WHERE id = ?')
    .get(payload.id) as AiruPromptRow | undefined

  if (!existing) return null

  const updated: AiruPromptRow = {
    ...existing,
    title: typeof payload.title === 'string' ? payload.title.trim() : existing.title,
    content: typeof payload.content === 'string' ? payload.content.trim() : existing.content,
    sort_order: typeof payload.sortOrder === 'number' ? payload.sortOrder : existing.sort_order,
    updated_at: Date.now(),
  }

  database
    .prepare(
      `UPDATE airu_prompts
       SET title = @title,
           content = @content,
           sort_order = @sort_order,
           updated_at = @updated_at
       WHERE id = @id`,
    )
    .run(updated)

  void pushAiruPromptToCloud(updated)
  return toAiruPrompt(updated)
}

export const deleteAiruPrompt = (id: string) => {
  const database = ensureDb()
  const updated_at = Date.now()
  database
    .prepare('UPDATE airu_prompts SET is_deleted = 1, updated_at = @updated_at WHERE id = @id')
    .run({ id, updated_at })
  void deleteAiruPromptFromCloud(id)
}

export const reorderAiruPrompts = (orderedIds: string[]) => {
  const database = ensureDb()
  const now = Date.now()

  const updateOrder = database.prepare(
    'UPDATE airu_prompts SET sort_order = @sort_order, updated_at = @updated_at WHERE id = @id',
  )
  const reorderTx = database.transaction((ids: string[]) => {
    ids.forEach((id, idx) => {
      updateOrder.run({ id, sort_order: idx, updated_at: now })
    })
  })
  reorderTx(orderedIds)

  // Sync all to cloud
  const rows = database
    .prepare('SELECT id, title, content, sort_order, created_at, updated_at, is_deleted FROM airu_prompts WHERE is_deleted = 0')
    .all() as AiruPromptRow[]
  rows.forEach((row) => void pushAiruPromptToCloud(row))
}

// --- Airu Settings (Local Only) ---

export const getAiruSettings = (): AiruSettings => {
  const database = ensureDb()
  const rows = database.prepare('SELECT key, value FROM airu_settings').all() as AiruSettingRow[]

  const settings: Record<string, string> = {}
  rows.forEach((row) => {
    settings[row.key] = row.value
  })

  return {
    openaiApiKey: settings.openaiApiKey,
    openaiModel: settings.openaiModel || DEFAULT_AIRU_SETTINGS.openaiModel,
    openaiTemperature: settings.openaiTemperature ? parseFloat(settings.openaiTemperature) : DEFAULT_AIRU_SETTINGS.openaiTemperature,
    openaiMaxTokens: settings.openaiMaxTokens ? parseInt(settings.openaiMaxTokens) : DEFAULT_AIRU_SETTINGS.openaiMaxTokens,
    openaiTopP: settings.openaiTopP ? parseFloat(settings.openaiTopP) : DEFAULT_AIRU_SETTINGS.openaiTopP,
    openaiFrequencyPenalty: settings.openaiFrequencyPenalty ? parseFloat(settings.openaiFrequencyPenalty) : DEFAULT_AIRU_SETTINGS.openaiFrequencyPenalty,
    openaiPresencePenalty: settings.openaiPresencePenalty ? parseFloat(settings.openaiPresencePenalty) : DEFAULT_AIRU_SETTINGS.openaiPresencePenalty,
    geminiApiKey: settings.geminiApiKey,
    geminiModel: settings.geminiModel || DEFAULT_AIRU_SETTINGS.geminiModel,
    claudeApiKey: settings.claudeApiKey,
    claudeModel: settings.claudeModel || DEFAULT_AIRU_SETTINGS.claudeModel,
  }
}

export const setAiruSetting = (key: string, value: string) => {
  const database = ensureDb()
  database
    .prepare('INSERT OR REPLACE INTO airu_settings (key, value) VALUES (@key, @value)')
    .run({ key, value })
}

export const setAiruSettings = (settings: Partial<AiruSettings>) => {
  const database = ensureDb()
  const upsert = database.prepare('INSERT OR REPLACE INTO airu_settings (key, value) VALUES (@key, @value)')
  const updateTx = database.transaction((entries: [string, string][]) => {
    entries.forEach(([key, value]) => {
      upsert.run({ key, value })
    })
  })

  const entries: [string, string][] = Object.entries(settings)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)])

  updateTx(entries)
}
