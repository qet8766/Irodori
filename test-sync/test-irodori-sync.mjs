// Test the actual Irodori sync logic (simulated without Electron)
import { Database as SQLiteCloudDatabase } from '@sqlitecloud/drivers'
import BetterSqlite3 from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SQLITE_CLOUD_URL =
  'sqlitecloud://cueadayivk.g5.sqlite.cloud:8860/auth.sqlitecloud?apikey=0JQcewFfcdbetJA6rZKLiHRW6Z2SgiUqrYcH8f7fQPM'

const results = []
const log = (msg) => {
  console.log(msg)
  results.push(msg)
}

const logSection = (title) => {
  log('')
  log('='.repeat(60))
  log(title)
  log('='.repeat(60))
}

// Simulated Irodori types
const normalizeCategory = (value) =>
  value === 'long_term' || value === 'project' || value === 'immediate' ? value : 'short_term'

const parseCloudTimestamp = (value) => {
  if (!value) return Date.now()
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

// Create local test database (simulating Machine B)
function createLocalDb(dbPath) {
  const instance = new BetterSqlite3(dbPath)
  instance.pragma('journal_mode = WAL')

  instance.exec(`
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

  return instance
}

// Fetch from cloud (exact same logic as Irodori)
async function fetchCloudSnapshot(cloudDb) {
  try {
    const [tasks, notes] = await Promise.all([
      cloudDb.sql('SELECT id, name, description, section, created FROM tasks'),
      cloudDb.sql('SELECT id, task_id, text FROM project_items'),
    ])

    return {
      tasks: Array.isArray(tasks) ? tasks : [],
      notes: Array.isArray(notes) ? notes : [],
    }
  } catch (error) {
    log(`❌ Failed to fetch cloud snapshot: ${error.message}`)
    return null
  }
}

// Sync from cloud (exact same logic as Irodori)
async function syncFromCloud(cloudDb, localDb) {
  log('Starting syncFromCloud...')

  const snapshot = await fetchCloudSnapshot(cloudDb)
  if (!snapshot) {
    log('❌ Cloud sync skipped - unable to fetch snapshot')
    return false
  }

  log(`📥 Fetched from cloud: ${snapshot.tasks.length} tasks, ${snapshot.notes.length} notes`)

  if (snapshot.tasks.length === 0 && snapshot.notes.length === 0) {
    log('⚠️ Cloud database is empty - no data to sync down')
  }

  const now = Date.now()

  // Map cloud tasks to local format
  const taskRows = snapshot.tasks.map((row) => {
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

  log(`📝 Mapped ${taskRows.length} tasks for local DB`)

  // Log first few tasks for debugging
  taskRows.slice(0, 3).forEach((task, i) => {
    log(`   ${i + 1}. [${task.id.substring(0, 8)}...] "${task.title}" (${task.category})`)
  })

  // Build valid task IDs for filtering orphaned notes
  const localTaskIds = localDb
    .prepare('SELECT id FROM tasks WHERE is_deleted = 0')
    .all()
  const validTaskIds = new Set([
    ...taskRows.map((t) => t.id),
    ...localTaskIds.map((t) => t.id),
  ])

  log(`📋 Valid task IDs: ${validTaskIds.size} (${taskRows.length} from cloud + ${localTaskIds.length} local)`)

  // Filter and map notes
  const noteRows = snapshot.notes
    .filter((row) => validTaskIds.has(row.task_id))
    .map((row) => ({
      id: row.id,
      task_id: row.task_id,
      content: (row.text ?? '').trim(),
      created_at: now,
      updated_at: now,
      is_deleted: 0,
    }))

  log(`📝 Mapped ${noteRows.length} notes for local DB (filtered from ${snapshot.notes.length})`)

  // Upsert tasks
  if (taskRows.length) {
    const upsertTask = localDb.prepare(
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
    const upsertTasksTx = localDb.transaction((rows) => {
      rows.forEach((row) => upsertTask.run(row))
    })
    upsertTasksTx(taskRows)
    log(`✅ Upserted ${taskRows.length} tasks to local DB`)
  }

  // Upsert notes
  if (noteRows.length) {
    const upsertNote = localDb.prepare(
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
    const upsertNotesTx = localDb.transaction((rows) => {
      rows.forEach((row) => upsertNote.run(row))
    })
    upsertNotesTx(noteRows)
    log(`✅ Upserted ${noteRows.length} notes to local DB`)
  }

  return true
}

// Read local tasks (exact same logic as Irodori's readLocalTasks)
function readLocalTasks(localDb) {
  const rows = localDb
    .prepare(
      `
        SELECT id, title, description, category, is_done, created_at, updated_at, is_deleted
        FROM tasks
        WHERE is_deleted = 0
        ORDER BY updated_at DESC
      `,
    )
    .all()

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    category: row.category,
    isDone: Boolean(row.is_done),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: Boolean(row.is_deleted),
  }))
}

async function runTests() {
  const startTime = new Date()
  log(`Irodori Sync Logic Test - Started at ${startTime.toISOString()}`)
  log(`Node.js ${process.version}`)
  log('')

  let cloudDb = null
  let localDb = null
  const testDbPath = path.join(__dirname, 'test-local.db')

  try {
    // Clean up previous test DB
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
      log('Cleaned up previous test database')
    }

    // Test 1: Connect to cloud
    logSection('TEST 1: Connect to SQLite Cloud')
    try {
      cloudDb = new SQLiteCloudDatabase(SQLITE_CLOUD_URL)
      await cloudDb.sql('SELECT 1')
      log('✅ Connected to SQLite Cloud')
    } catch (error) {
      log(`❌ Failed to connect: ${error.message}`)
      throw error
    }

    // Test 2: Create fresh local database
    logSection('TEST 2: Create Fresh Local Database')
    try {
      localDb = createLocalDb(testDbPath)
      log('✅ Created fresh local database')

      const taskCount = localDb.prepare('SELECT COUNT(*) as count FROM tasks').get()
      log(`   Initial task count: ${taskCount.count}`)
    } catch (error) {
      log(`❌ Failed to create local DB: ${error.message}`)
      throw error
    }

    // Test 3: Fetch raw cloud data
    logSection('TEST 3: Fetch Raw Cloud Data')
    try {
      const tasks = await cloudDb.sql('SELECT * FROM tasks')
      const notes = await cloudDb.sql('SELECT * FROM project_items')

      log(`Raw cloud data:`)
      log(`   Tasks: ${tasks?.length || 0}`)
      log(`   Project Items: ${notes?.length || 0}`)

      if (tasks && tasks.length > 0) {
        log('')
        log('First 5 tasks from cloud:')
        tasks.slice(0, 5).forEach((t, i) => {
          log(`   ${i + 1}. id="${t.id}"`)
          log(`      name="${t.name}"`)
          log(`      section="${t.section}"`)
          log(`      created="${t.created}"`)
        })
      }
    } catch (error) {
      log(`❌ Failed to fetch raw data: ${error.message}`)
    }

    // Test 4: Run Irodori's syncFromCloud
    logSection('TEST 4: Run syncFromCloud (Irodori Logic)')
    try {
      const success = await syncFromCloud(cloudDb, localDb)
      log(`syncFromCloud returned: ${success}`)
    } catch (error) {
      log(`❌ syncFromCloud failed: ${error.message}`)
      log(error.stack)
    }

    // Test 5: Read local tasks after sync
    logSection('TEST 5: Read Local Tasks After Sync')
    try {
      const localTasks = readLocalTasks(localDb)
      log(`Local tasks after sync: ${localTasks.length}`)

      if (localTasks.length > 0) {
        log('')
        log('First 5 local tasks:')
        localTasks.slice(0, 5).forEach((t, i) => {
          log(`   ${i + 1}. [${t.id.substring(0, 8)}...] "${t.title}" (${t.category})`)
        })
      } else {
        log('⚠️ NO TASKS IN LOCAL DATABASE AFTER SYNC!')
      }
    } catch (error) {
      log(`❌ Failed to read local tasks: ${error.message}`)
    }

    // Test 6: Verify data integrity
    logSection('TEST 6: Verify Data Integrity')
    try {
      const cloudTasks = await cloudDb.sql('SELECT id FROM tasks')
      const localTasks = localDb.prepare('SELECT id FROM tasks WHERE is_deleted = 0').all()

      const cloudIds = new Set(cloudTasks.map(t => t.id))
      const localIds = new Set(localTasks.map(t => t.id))

      log(`Cloud task IDs: ${cloudIds.size}`)
      log(`Local task IDs: ${localIds.size}`)

      const missingLocally = [...cloudIds].filter(id => !localIds.has(id))
      const extraLocally = [...localIds].filter(id => !cloudIds.has(id))

      if (missingLocally.length > 0) {
        log(`❌ ${missingLocally.length} tasks missing locally:`)
        missingLocally.slice(0, 5).forEach(id => log(`   - ${id}`))
      } else {
        log('✅ All cloud tasks exist locally')
      }

      if (extraLocally.length > 0) {
        log(`ℹ️ ${extraLocally.length} extra local tasks (not in cloud)`)
      }
    } catch (error) {
      log(`❌ Integrity check failed: ${error.message}`)
    }

    // Test 7: Simulate second sync (should be idempotent)
    logSection('TEST 7: Second Sync (Idempotency Test)')
    try {
      const beforeCount = localDb.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_deleted = 0').get()
      log(`Tasks before second sync: ${beforeCount.count}`)

      await syncFromCloud(cloudDb, localDb)

      const afterCount = localDb.prepare('SELECT COUNT(*) as count FROM tasks WHERE is_deleted = 0').get()
      log(`Tasks after second sync: ${afterCount.count}`)

      if (beforeCount.count === afterCount.count) {
        log('✅ Sync is idempotent (same count)')
      } else {
        log(`⚠️ Count changed: ${beforeCount.count} -> ${afterCount.count}`)
      }
    } catch (error) {
      log(`❌ Second sync failed: ${error.message}`)
    }

  } catch (error) {
    log('')
    log(`FATAL ERROR: ${error.message}`)
    log(error.stack)
  } finally {
    if (cloudDb) {
      try { cloudDb.close() } catch {}
    }
    if (localDb) {
      try { localDb.close() } catch {}
    }
  }

  const endTime = new Date()
  const duration = endTime - startTime

  logSection('TEST SUMMARY')
  log(`Started: ${startTime.toISOString()}`)
  log(`Ended: ${endTime.toISOString()}`)
  log(`Duration: ${duration}ms`)

  // Save results
  const resultsText = results.join('\n')
  fs.writeFileSync(path.join(__dirname, 'irodori-sync-test-results.txt'), resultsText)
  log('')
  log('Results saved to irodori-sync-test-results.txt')

  return resultsText
}

runTests().catch(console.error)
