import OpenAI from 'openai'
import { AzureOpenAI } from 'openai'

// ===========================================
// CONFIGURATION - Fill in your Azure details
// ===========================================
const AZURE_CONFIG = {
  apiKey: process.env.AZURE_OPENAI_KEY || 'your-azure-key-here',
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com',
  deployment: process.env.AZURE_DEPLOYMENT_NAME || 'gpt-4o', // or gpt-35-turbo
  apiVersion: '2024-08-01-preview'
}

const TEST_PROMPT = 'Fix typos in this text. Return ONLY the corrected text: teh quikc brown fox jumsp'
const RUNS = 5

// ===========================================
// Clients
// ===========================================
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const azureClient = new AzureOpenAI({
  apiKey: AZURE_CONFIG.apiKey,
  endpoint: AZURE_CONFIG.endpoint,
  deployment: AZURE_CONFIG.deployment,
  apiVersion: AZURE_CONFIG.apiVersion
})

// ===========================================
// Benchmark Functions
// ===========================================
async function testOpenAI(): Promise<number> {
  const start = Date.now()
  await openaiClient.responses.create({
    model: 'gpt-5.1',
    input: TEST_PROMPT,
    reasoning: { effort: 'none' }
  } as any)
  return Date.now() - start
}

async function testAzure(): Promise<number> {
  const start = Date.now()
  await azureClient.chat.completions.create({
    model: AZURE_CONFIG.deployment,
    messages: [{ role: 'user', content: TEST_PROMPT }],
    max_tokens: 100
  })
  return Date.now() - start
}

async function benchmark(name: string, fn: () => Promise<number>) {
  console.log(`\n${name}`)
  console.log('─'.repeat(40))

  const times: number[] = []

  for (let i = 0; i < RUNS; i++) {
    try {
      const ms = await fn()
      times.push(ms)
      console.log(`  Run ${i + 1}: ${ms}ms`)
    } catch (err) {
      console.log(`  Run ${i + 1}: ERROR - ${err instanceof Error ? err.message : err}`)
    }
  }

  if (times.length > 0) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    const min = Math.min(...times)
    const max = Math.max(...times)
    console.log(`\n  Avg: ${avg}ms | Min: ${min}ms | Max: ${max}ms`)
  }

  return times
}

// ===========================================
// Main
// ===========================================
async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║   OpenAI vs Azure Latency Comparison   ║')
  console.log('╚════════════════════════════════════════╝')
  console.log(`\nTest prompt: "${TEST_PROMPT}"`)
  console.log(`Runs per test: ${RUNS}`)

  // Test OpenAI first
  const openaiTimes = await benchmark('OpenAI Direct (US)', testOpenAI)

  // Test Azure
  const azureTimes = await benchmark(`Azure OpenAI (${AZURE_CONFIG.endpoint})`, testAzure)

  // Summary
  if (openaiTimes.length > 0 && azureTimes.length > 0) {
    const openaiAvg = Math.round(openaiTimes.reduce((a, b) => a + b, 0) / openaiTimes.length)
    const azureAvg = Math.round(azureTimes.reduce((a, b) => a + b, 0) / azureTimes.length)
    const diff = openaiAvg - azureAvg

    console.log('\n╔════════════════════════════════════════╗')
    console.log('║              SUMMARY                   ║')
    console.log('╚════════════════════════════════════════╝')
    console.log(`  OpenAI Avg:  ${openaiAvg}ms`)
    console.log(`  Azure Avg:   ${azureAvg}ms`)
    console.log(`  Difference:  ${diff > 0 ? '+' : ''}${diff}ms ${diff > 0 ? '(Azure faster)' : '(OpenAI faster)'}`)
  }
}

main().catch(console.error)
