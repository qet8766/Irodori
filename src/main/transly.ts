import { spawn } from 'node:child_process'
import OpenAI from 'openai'
import { clipboard } from './electron'

export type TranslyTiming = {
  totalMs: number
  copyMs?: number
  apiMs?: number
  pasteMs?: number
}

export type TranslyResult = {
  input: string
  output: string
  pasted: boolean
  error?: string
  timing?: TranslyTiming
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

// Use Win32 SendInput via PowerShell to send clipboard shortcuts more reliably on Windows.
const windowsSendInputScript = (key: 'C' | 'V') => `
$src = @"
using System;
using System.Runtime.InteropServices;
public static class TranslySendKey {
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT { public uint type; public INPUTUNION U; }
  [StructLayout(LayoutKind.Explicit)]
  public struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)]
  public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  const int INPUT_KEYBOARD = 1;
  const uint KEYEVENTF_KEYUP = 0x0002;
  public static void SendCombo(ushort key) {
    INPUT[] inputs = new INPUT[4];
    inputs[0].type = INPUT_KEYBOARD; inputs[0].U.ki.wVk = 0x11; // Ctrl down
    inputs[1].type = INPUT_KEYBOARD; inputs[1].U.ki.wVk = key;   // key down
    inputs[2].type = INPUT_KEYBOARD; inputs[2].U.ki.wVk = key; inputs[2].U.ki.dwFlags = KEYEVENTF_KEYUP; // key up
    inputs[3].type = INPUT_KEYBOARD; inputs[3].U.ki.wVk = 0x11; inputs[3].U.ki.dwFlags = KEYEVENTF_KEYUP; // Ctrl up
    SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
  }
}
"@
Add-Type -TypeDefinition $src -ErrorAction SilentlyContinue
[TranslySendKey]::SendCombo(${key === 'C' ? '0x43' : '0x56'})
`

const tryPasteIntoActiveWindow = async () =>
  await new Promise<boolean>((resolve) => {
    const platform = process.platform
    let child: ReturnType<typeof spawn> | null = null

    if (platform === 'win32') {
      child = spawn('powershell', ['-NoProfile', '-Command', windowsSendInputScript('V')], { windowsHide: true })
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
      child = spawn('powershell', ['-NoProfile', '-Command', windowsSendInputScript('C')], { windowsHide: true })
    } else if (platform === 'darwin') {
      child = spawn('osascript', ['-e', 'tell application "System Events" to keystroke \"c\" using command down'])
    } else if (platform === 'linux') {
      child = spawn('sh', ['-lc', 'command -v xdotool >/dev/null 2>&1 && xdotool key --clearmodifiers ctrl+c'])
    }

    if (!child) return resolve(false)

    child.once('error', () => resolve(false))
    child.once('exit', (code) => resolve(code === 0))
  })

export const correctWord = async (
  word: string,
  pasteAfter = true,
  timingSeed: Partial<TranslyTiming> = {},
): Promise<TranslyResult> => {
  const start = Date.now()
  const trimmed = word.trim()
  if (!trimmed) {
    return { input: word, output: '', pasted: false, error: 'Clipboard was empty', timing: { ...timingSeed, totalMs: Date.now() - start } }
  }

  try {
    const ai = getClient()
    const apiStart = Date.now()
    const response = await ai.responses.create({
      model: 'gpt-4.1-2025-04-14',
      input: `${basePrompt}\n\n${trimmed}`,
    })
    const apiMs = Date.now() - apiStart

    const output = extractOutputText(response)
    if (!output) {
      return { input: trimmed, output: '', pasted: false, error: 'Model did not return a word', timing: { ...timingSeed, apiMs, totalMs: Date.now() - start } }
    }

    clipboard.writeText(output)
    const pasteStart = Date.now()
    const pasted = pasteAfter ? await tryPasteIntoActiveWindow() : false
    const pasteMs = Date.now() - pasteStart

    return {
      input: trimmed,
      output,
      pasted,
      timing: { ...timingSeed, apiMs, pasteMs, totalMs: Date.now() - start },
    }
  } catch (error) {
    return {
      input: trimmed,
      output: '',
      pasted: false,
      error: error instanceof Error ? error.message : 'Failed to correct word',
      timing: { ...timingSeed, totalMs: Date.now() - start },
    }
  }
}

export const correctFromActiveSelection = async (): Promise<TranslyResult> => {
  const start = Date.now()
  const copyStart = Date.now()
  const copied = await tryCopyFromActiveWindow()
  await sleep(120)
  const copyMs = Date.now() - copyStart
  const latestClipboard = clipboard.readText()
  if (!copied && !latestClipboard.trim()) {
    return { input: '', output: '', pasted: false, error: 'Nothing copied from selection', timing: { copyMs, totalMs: Date.now() - start } }
  }

  return correctWord(latestClipboard, true, { copyMs, totalMs: Date.now() - start })
}
