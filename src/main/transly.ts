import { spawn } from 'node:child_process'
import OpenAI from 'openai'
import { clipboard } from './electron'

export type TranslyResult = {
  input: string
  output: string
  pasted: boolean
  error?: string
}

const basePrompt = 'If there is a typo or misspelling in the word given, correct the word. only answer with one word.'
let client: OpenAI | null = null
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

const extractOutputText = (response: any) => {
  if (response?.output_text) return String(response.output_text).trim()
  const firstMessage = response?.output?.[0]?.content?.find?.((item: any) => item?.type === 'output_text')
  if (firstMessage?.text) return String(firstMessage.text).trim()
  return ''
}

const tryPasteIntoActiveWindow = async () =>
  await new Promise<boolean>((resolve) => {
    const platform = process.platform
    let child: ReturnType<typeof spawn> | null = null

    if (platform === 'win32') {
      child = spawn('powershell', [
        '-Command',
        "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^v')",
      ], { windowsHide: true })
    } else if (platform === 'darwin') {
      child = spawn('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])
    } else if (platform === 'linux') {
      child = spawn('sh', ['-lc', 'command -v xdotool >/dev/null 2>&1 && xdotool key --clearmodifiers ctrl+v'])
    }

    if (!child) return resolve(false)

    child.once('error', () => resolve(false))
    child.once('exit', (code) => resolve(code === 0))
  })

const tryCopyFromActiveWindow = async () =>
  await new Promise<boolean>((resolve) => {
    const platform = process.platform
    let child: ReturnType<typeof spawn> | null = null

    if (platform === 'win32') {
      child = spawn('powershell', [
        '-Command',
        "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^c')",
      ], { windowsHide: true })
    } else if (platform === 'darwin') {
      child = spawn('osascript', ['-e', 'tell application "System Events" to keystroke \"c\" using command down'])
    } else if (platform === 'linux') {
      child = spawn('sh', ['-lc', 'command -v xdotool >/dev/null 2>&1 && xdotool key --clearmodifiers ctrl+c'])
    }

    if (!child) return resolve(false)

    child.once('error', () => resolve(false))
    child.once('exit', (code) => resolve(code === 0))
  })

export const correctWord = async (word: string, pasteAfter = true): Promise<TranslyResult> => {
  const trimmed = word.trim()
  if (!trimmed) return { input: word, output: '', pasted: false, error: 'Clipboard was empty' }

  try {
    const ai = getClient()
    const response = await ai.responses.create({
      model: 'gpt-5-nano',
      input: `${basePrompt}\n\n${trimmed}`,
    })

    const output = extractOutputText(response)
    if (!output) {
      return { input: trimmed, output: '', pasted: false, error: 'Model did not return a word' }
    }

    clipboard.writeText(output)
    const pasted = pasteAfter ? await tryPasteIntoActiveWindow() : false

    return { input: trimmed, output, pasted }
  } catch (error) {
    return {
      input: trimmed,
      output: '',
      pasted: false,
      error: error instanceof Error ? error.message : 'Failed to correct word',
    }
  }
}

export const correctFromActiveSelection = async (): Promise<TranslyResult> => {
  const copied = await tryCopyFromActiveWindow()
  await sleep(120)
  const latestClipboard = clipboard.readText()
  if (!copied && !latestClipboard.trim()) {
    return { input: '', output: '', pasted: false, error: 'Nothing copied from selection' }
  }

  return correctWord(latestClipboard, true)
}
