// Module 2: Pull data from SQLite Cloud (completely independent)
import { Database } from '@sqlitecloud/drivers'

const SQLITE_CLOUD_URL =
  'sqlitecloud://cueadayivk.g5.sqlite.cloud:8860/auth.sqlitecloud?apikey=0JQcewFfcdbetJA6rZKLiHRW6Z2SgiUqrYcH8f7fQPM'

let db = null

export async function createConnection() {
  // Create a completely new connection (simulating different machine)
  db = new Database(SQLITE_CLOUD_URL)
  await db.sql('SELECT 1') // Test connection
  return db
}

export async function closeConnection() {
  if (db) {
    db.close()
    db = null
  }
}

export async function pullTestData(database) {
  const client = database || db
  try {
    const results = await client.sql('SELECT * FROM sync_test ORDER BY timestamp DESC')
    return Array.isArray(results) ? results : []
  } catch (error) {
    console.error('Failed to pull test data:', error.message)
    return null
  }
}

export async function pullTasks(database) {
  const client = database || db
  try {
    const results = await client.sql('SELECT id, name, description, section, created FROM tasks')
    return Array.isArray(results) ? results : []
  } catch (error) {
    console.error('Failed to pull tasks:', error.message)
    return null
  }
}

export async function pullProjectItems(database) {
  const client = database || db
  try {
    const results = await client.sql('SELECT id, task_id, text FROM project_items')
    return Array.isArray(results) ? results : []
  } catch (error) {
    console.error('Failed to pull project items:', error.message)
    return null
  }
}

export async function pullSpecificTestData(database, testId) {
  const client = database || db
  try {
    const results = await client.sql('SELECT * FROM sync_test WHERE id = ?', testId)
    return Array.isArray(results) && results.length > 0 ? results[0] : null
  } catch (error) {
    console.error('Failed to pull specific test data:', error.message)
    return null
  }
}
