import OpenAI from 'openai'
import { clipboard } from '../electron'
import { sendKeyboardCommand, sleep } from './keyboard.service'

const MODEL = 'gpt-5.1'
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TIMING = {
  HOTKEY_RELEASE: 0,
  MODIFIER_RELEASE_WAIT: 80,
  CLIPBOARD_UPDATE: 0,
  CLIPBOARD_POLL_MAX: 1200,
  CLIPBOARD_POLL_INTERVAL: 25,
  PASTE_DELAY: 60,
  CLEAR_DELAY: 0,
} as const

export type TranslyResult = {
  input: string
  output: string
  pasted: boolean
  error?: string
  timing?: {
    totalMs: number
    apiMs?: number
    clipboardMs?: number
    pasteMs?: number
  }
}

export type TranslateOptionsResult = {
  input: string
  options: string[]
  error?: string
  timing?: {
    totalMs: number
    apiMs?: number
    clipboardMs?: number
  }
}

const createResult = (
  input: string,
  output: string,
  pasted: boolean,
  startTime: number,
  error?: string,
  apiMs?: number,
  clipboardMs?: number,
  pasteMs?: number,
): TranslyResult => ({
  input,
  output,
  pasted,
  error,
  timing: {
    totalMs: Date.now() - startTime,
    apiMs,
    clipboardMs,
    pasteMs,
  },
})

export const correctFromActiveSelection = async (): Promise<TranslyResult> => {
  const startTime = Date.now()

  clipboard.writeText('')
  await sleep(TIMING.CLEAR_DELAY)

  try {
    await sleep(TIMING.HOTKEY_RELEASE)
    await sendKeyboardCommand('R')
    await sleep(TIMING.MODIFIER_RELEASE_WAIT)

    const copyResult = await sendKeyboardCommand('C')
    await sleep(TIMING.CLIPBOARD_UPDATE)

    // Poll clipboard
    const clipboardStart = Date.now()
    let copiedText = ''
    const pollStart = Date.now()
    while (Date.now() - pollStart < TIMING.CLIPBOARD_POLL_MAX) {
      copiedText = clipboard.readText()
      if (copiedText) break
      await sleep(TIMING.CLIPBOARD_POLL_INTERVAL)
    }
    const clipboardMs = Date.now() - clipboardStart

    if (!copiedText) {
      return createResult('', '', false, startTime, `Copy failed. Debug: ${copyResult}`, undefined, clipboardMs)
    }

    // API Call with GPT-5.1 settings
    const apiStart = Date.now()
    const response = await client.responses.create({
      model: MODEL,
      input: `Fix typos in this text. Return ONLY the corrected word/phrase, nothing else: ${copiedText}`,
      reasoning: { effort: 'none' },
      text: { verbosity: 'low' },
    } as any)
    const apiMs = Date.now() - apiStart

    const corrected = response.output_text?.trim()

    if (!corrected) {
      return createResult(copiedText, '', false, startTime, 'API returned empty', apiMs, clipboardMs)
    }

    const pasteStart = Date.now()
    clipboard.writeText(corrected)
    await sleep(TIMING.PASTE_DELAY)
    await sendKeyboardCommand('V')
    const pasteMs = Date.now() - pasteStart

    return createResult(copiedText, corrected, true, startTime, undefined, apiMs, clipboardMs, pasteMs)
  } catch (err) {
    return createResult('', '', false, startTime, err instanceof Error ? err.message : 'Unknown error')
  }
}

export const translateOptions = async (): Promise<TranslateOptionsResult> => {
  const startTime = Date.now()

  clipboard.writeText('')
  await sleep(TIMING.CLEAR_DELAY)

  try {
    await sleep(TIMING.HOTKEY_RELEASE)
    await sendKeyboardCommand('R')
    await sleep(TIMING.MODIFIER_RELEASE_WAIT)

    const copyResult = await sendKeyboardCommand('C')
    await sleep(TIMING.CLIPBOARD_UPDATE)

    // Poll clipboard
    const clipboardStart = Date.now()
    let copiedText = ''
    const pollStart = Date.now()
    while (Date.now() - pollStart < TIMING.CLIPBOARD_POLL_MAX) {
      copiedText = clipboard.readText()
      if (copiedText) break
      await sleep(TIMING.CLIPBOARD_POLL_INTERVAL)
    }
    const clipboardMs = Date.now() - clipboardStart

    if (!copiedText) {
      return {
        input: '',
        options: [],
        error: `Copy failed. Debug: ${copyResult}`,
        timing: { totalMs: Date.now() - startTime, clipboardMs },
      }
    }

    // API Call with structured outputs
    const apiStart = Date.now()
    const response = await client.responses.create({
      model: MODEL,
      input: `A Korean word or short phrase will be given. Give up to 6 options to translate into English. Since there can be diverse meanings and contexts, try to give a diverse range of options.\n\nKorean: ${copiedText}`,
      reasoning: { effort: 'low' },
      text: {
        format: {
          type: 'json_schema',
          name: 'translation_options',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Up to 6 English translation options',
              },
            },
            required: ['options'],
            additionalProperties: false,
          },
        },
      },
    } as any)
    const apiMs = Date.now() - apiStart

    const parsed = JSON.parse(response.output_text || '{}')
    const options: string[] = parsed.options || []

    return {
      input: copiedText,
      options,
      timing: { totalMs: Date.now() - startTime, apiMs, clipboardMs },
    }
  } catch (err) {
    return {
      input: '',
      options: [],
      error: err instanceof Error ? err.message : 'Unknown error',
      timing: { totalMs: Date.now() - startTime },
    }
  }
}

export const pasteSelectedOption = async (option: string): Promise<void> => {
  clipboard.writeText(option)
  await sleep(TIMING.PASTE_DELAY)
  await sendKeyboardCommand('V')
}
