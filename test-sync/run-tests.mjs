// Main test runner - isolated SQLite Cloud sync tests
import * as pusher from './pusher.mjs'
import * as puller from './puller.mjs'
import fs from 'fs'

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

async function runTests() {
  const startTime = new Date()
  log(`SQLite Cloud Sync Test - Started at ${startTime.toISOString()}`)
  log(`Node.js ${process.version}`)
  log('')

  let pushDb = null
  let pullDb = null

  try {
    // Test 1: Connection Test (Pusher)
    logSection('TEST 1: Pusher Connection')
    try {
      pushDb = await pusher.createConnection()
      log('✅ Pusher connected successfully')
    } catch (error) {
      log(`❌ Pusher connection failed: ${error.message}`)
      throw error
    }

    // Test 2: Connection Test (Puller - Independent)
    logSection('TEST 2: Puller Connection (Independent)')
    try {
      pullDb = await puller.createConnection()
      log('✅ Puller connected successfully (separate connection)')
    } catch (error) {
      log(`❌ Puller connection failed: ${error.message}`)
      throw error
    }

    // Test 3: Ensure Tables Exist
    logSection('TEST 3: Ensure Tables')
    try {
      await pusher.ensureTables(pushDb)
      log('✅ Tables created/verified')
    } catch (error) {
      log(`❌ Table creation failed: ${error.message}`)
    }

    // Test 4: Clear previous test data
    logSection('TEST 4: Clear Test Data')
    try {
      await pusher.clearTestData(pushDb)
      log('✅ Test data cleared')
    } catch (error) {
      log(`⚠️ Clear test data failed (might not exist): ${error.message}`)
    }

    // Test 5: Push test data from pusher
    logSection('TEST 5: Push Test Data')
    const testId = `test_${Date.now()}`
    const testValue = `Hello from pusher at ${new Date().toISOString()}`
    try {
      const pushed = await pusher.pushTestData(pushDb, testId, testValue)
      log(`✅ Pushed test data:`)
      log(`   ID: ${pushed.id}`)
      log(`   Value: ${pushed.value}`)
      log(`   Timestamp: ${pushed.timestamp}`)
    } catch (error) {
      log(`❌ Push test data failed: ${error.message}`)
    }

    // Test 6: Pull test data from puller (different connection)
    logSection('TEST 6: Pull Test Data (Different Connection)')
    try {
      const pulled = await puller.pullSpecificTestData(pullDb, testId)
      if (pulled) {
        log(`✅ Pulled test data:`)
        log(`   ID: ${pulled.id}`)
        log(`   Value: ${pulled.value}`)
        log(`   Timestamp: ${pulled.timestamp}`)

        if (pulled.value === testValue) {
          log(`✅ DATA MATCHES - Sync working correctly!`)
        } else {
          log(`❌ DATA MISMATCH!`)
          log(`   Expected: ${testValue}`)
          log(`   Got: ${pulled.value}`)
        }
      } else {
        log(`❌ Failed to pull test data - returned null`)
      }
    } catch (error) {
      log(`❌ Pull test data failed: ${error.message}`)
    }

    // Test 7: Check existing tasks in cloud
    logSection('TEST 7: Check Existing Tasks in Cloud')
    try {
      const tasks = await puller.pullTasks(pullDb)
      log(`Found ${tasks?.length || 0} tasks in cloud:`)
      if (tasks && tasks.length > 0) {
        tasks.slice(0, 5).forEach((task, i) => {
          log(`   ${i + 1}. [${task.id?.substring(0, 8)}...] ${task.name} (${task.section})`)
        })
        if (tasks.length > 5) {
          log(`   ... and ${tasks.length - 5} more`)
        }
      } else {
        log(`   ⚠️ No tasks found in cloud database`)
      }
    } catch (error) {
      log(`❌ Pull tasks failed: ${error.message}`)
    }

    // Test 8: Check existing project items
    logSection('TEST 8: Check Existing Project Items in Cloud')
    try {
      const items = await puller.pullProjectItems(pullDb)
      log(`Found ${items?.length || 0} project items in cloud:`)
      if (items && items.length > 0) {
        items.slice(0, 5).forEach((item, i) => {
          log(`   ${i + 1}. [${item.id?.substring(0, 8)}...] -> task ${item.task_id?.substring(0, 8)}...`)
        })
        if (items.length > 5) {
          log(`   ... and ${items.length - 5} more`)
        }
      } else {
        log(`   ⚠️ No project items found in cloud database`)
      }
    } catch (error) {
      log(`❌ Pull project items failed: ${error.message}`)
    }

    // Test 9: Push a task and verify sync
    logSection('TEST 9: Push Task and Verify Sync')
    const testTaskId = `test_task_${Date.now()}`
    const testTask = {
      id: testTaskId,
      name: 'Test Task from Sync Test',
      description: 'This is a test task created by the sync test suite',
      section: 'short_term',
      created: new Date().toISOString()
    }
    try {
      await pusher.pushTask(pushDb, testTask)
      log(`✅ Pushed test task: ${testTask.name}`)

      // Wait a moment then pull from different connection
      await new Promise(r => setTimeout(r, 500))

      const tasks = await puller.pullTasks(pullDb)
      const found = tasks?.find(t => t.id === testTaskId)
      if (found) {
        log(`✅ Task synced successfully!`)
        log(`   Name: ${found.name}`)
        log(`   Section: ${found.section}`)
      } else {
        log(`❌ Task not found in pulled data`)
      }

      // Cleanup: delete test task
      await pusher.deleteTask(pushDb, testTaskId)
      log(`✅ Test task cleaned up`)
    } catch (error) {
      log(`❌ Task sync test failed: ${error.message}`)
    }

    // Test 10: Latency test
    logSection('TEST 10: Latency Test')
    try {
      const iterations = 5
      const latencies = []

      for (let i = 0; i < iterations; i++) {
        const start = Date.now()
        await pullDb.sql('SELECT 1')
        const latency = Date.now() - start
        latencies.push(latency)
        log(`   Round ${i + 1}: ${latency}ms`)
      }

      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      log(`   Average latency: ${avg}ms`)
    } catch (error) {
      log(`❌ Latency test failed: ${error.message}`)
    }

    // Test 11: All test data in sync_test table
    logSection('TEST 11: All Test Data in sync_test Table')
    try {
      const allTestData = await puller.pullTestData(pullDb)
      log(`Found ${allTestData?.length || 0} entries in sync_test table:`)
      if (allTestData && allTestData.length > 0) {
        allTestData.forEach((entry, i) => {
          log(`   ${i + 1}. ID: ${entry.id}, Timestamp: ${entry.timestamp}`)
        })
      }
    } catch (error) {
      log(`❌ Pull all test data failed: ${error.message}`)
    }

  } catch (error) {
    log('')
    log(`FATAL ERROR: ${error.message}`)
    log(error.stack)
  } finally {
    // Cleanup connections
    if (pushDb) {
      try { pushDb.close() } catch {}
    }
    if (pullDb) {
      try { await puller.closeConnection() } catch {}
    }
  }

  const endTime = new Date()
  const duration = endTime - startTime

  logSection('TEST SUMMARY')
  log(`Started: ${startTime.toISOString()}`)
  log(`Ended: ${endTime.toISOString()}`)
  log(`Duration: ${duration}ms`)

  // Save results to file
  const resultsText = results.join('\n')
  fs.writeFileSync('sync-test-results.txt', resultsText)
  log('')
  log('Results saved to sync-test-results.txt')

  return resultsText
}

runTests().catch(console.error)
