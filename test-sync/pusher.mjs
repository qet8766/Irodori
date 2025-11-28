// Module 1: Push dummy data to SQLite Cloud
import { Database } from '@sqlitecloud/drivers'

const SQLITE_CLOUD_URL =
  'sqlitecloud://cueadayivk.g5.sqlite.cloud:8860/auth.sqlitecloud?apikey=0JQcewFfcdbetJA6rZKLiHRW6Z2SgiUqrYcH8f7fQPM'

export async function createConnection() {
  const db = new Database(SQLITE_CLOUD_URL)
  await db.sql('SELECT 1') // Test connection
  return db
}

export async function ensureTables(db) {
  await db.sql(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      section TEXT,
      created TEXT
    )
  `)

  await db.sql(`
    CREATE TABLE IF NOT EXISTS project_items (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      text TEXT
    )
  `)

  await db.sql(`
    CREATE TABLE IF NOT EXISTS sync_test (
      id TEXT PRIMARY KEY,
      value TEXT,
      timestamp TEXT
    )
  `)
}

export async function clearTestData(db) {
  await db.sql("DELETE FROM sync_test")
  // Don't clear tasks/project_items as they might have real data
}

export async function pushTestData(db, testId, value) {
  const timestamp = new Date().toISOString()
  await db.sql(
    'INSERT OR REPLACE INTO sync_test (id, value, timestamp) VALUES (?, ?, ?)',
    testId,
    value,
    timestamp
  )
  return { id: testId, value, timestamp }
}

export async function pushTask(db, task) {
  await db.sql(
    'INSERT OR REPLACE INTO tasks (id, name, description, section, created) VALUES (?, ?, ?, ?, ?)',
    task.id,
    task.name,
    task.description || '',
    task.section || 'short_term',
    task.created || new Date().toISOString()
  )
  return task
}

export async function deleteTask(db, id) {
  await db.sql('DELETE FROM tasks WHERE id = ?', id)
}

export async function getAllTasks(db) {
  return await db.sql('SELECT * FROM tasks')
}

export async function getAllTestData(db) {
  return await db.sql('SELECT * FROM sync_test')
}
