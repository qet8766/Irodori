import { spawn } from 'node:child_process'
import OpenAI from 'openai'
import { clipboard } from './electron'

const MODEL = 'gpt-5.1'
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TIMING = {
  HOTKEY_RELEASE: 250,
  MODIFIER_RELEASE_WAIT: 80,
  CLIPBOARD_UPDATE: 120,
  CLIPBOARD_POLL_MAX: 1200,
  CLIPBOARD_POLL_INTERVAL: 25,
  PASTE_DELAY: 60,
  CLEAR_DELAY: 30,
  WORKER_READY_TIMEOUT: 5000,
  COMMAND_TIMEOUT: 1800
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

// --- POWERSHELL WORKER ---
let psWorker: ReturnType<typeof spawn> | null = null
let workerReady = false
let workerReadyPromise: Promise<void> | null = null

const getWorker = (): { worker: ReturnType<typeof spawn>; ready: Promise<void> } => {
  if (psWorker && !psWorker.killed && workerReadyPromise) {
    return { worker: psWorker, ready: workerReadyPromise }
  }

  // Using here-string with single quotes to avoid variable interpolation issues
  const csharpCode = `
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class KeyboardSimulator {
    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint MapVirtualKey(uint uCode, uint uMapType);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    private const int INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT {
        public uint type;
        public INPUTUNION u;
    }

    [StructLayout(LayoutKind.Explicit, Size = 28)]
    private struct INPUTUNION {
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    private static INPUT MakeKeyInput(ushort vk, bool keyUp) {
        INPUT input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.u.ki.wVk = vk;
        input.u.ki.wScan = (ushort)MapVirtualKey(vk, 0);
        input.u.ki.dwFlags = keyUp ? KEYEVENTF_KEYUP : 0;
        input.u.ki.time = 0;
        input.u.ki.dwExtraInfo = IntPtr.Zero;
        return input;
    }

    public static string ReleaseAllModifiers() {
        int released = 0;
        ushort[] modifiers = { 0x10, 0x11, 0x12, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0x5B, 0x5C };
        
        foreach (ushort vk in modifiers) {
            if ((GetAsyncKeyState(vk) & 0x8000) != 0) {
                INPUT[] inputs = new INPUT[1];
                inputs[0] = MakeKeyInput(vk, true);
                SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
                released++;
            }
        }
        return "RELEASED:" + released;
    }

    public static string SendCtrlKey(ushort key) {
        try {
            IntPtr hwnd = GetForegroundWindow();
            int structSize = Marshal.SizeOf(typeof(INPUT));
            
            INPUT[] inputs = new INPUT[4];
            inputs[0] = MakeKeyInput(0x11, false);  // Ctrl down
            inputs[1] = MakeKeyInput(key, false);    // Key down
            inputs[2] = MakeKeyInput(key, true);     // Key up  
            inputs[3] = MakeKeyInput(0x11, true);    // Ctrl up

            uint sent = SendInput(4, inputs, structSize);
            int err = sent == 0 ? Marshal.GetLastWin32Error() : 0;
            
            return "OK:sent=" + sent + ",size=" + structSize + ",err=" + err + ",hwnd=" + hwnd;
        } catch (Exception ex) {
            return "ERR:" + ex.Message;
        }
    }
}
`

  const psScript = `
$csharpCode = @'
${csharpCode}
'@

try {
    Add-Type -TypeDefinition $csharpCode -ErrorAction Stop
    Write-Output "READY"
} catch {
    Write-Output "COMPILE_ERROR: $_"
}

while($true) {
    $cmd = [Console]::In.ReadLine()
    if ($cmd -eq $null) { break }
    
    if ($cmd -eq "R") {
        $result = [KeyboardSimulator]::ReleaseAllModifiers()
        Write-Output $result
    }
    if ($cmd -eq "C") { 
        $result = [KeyboardSimulator]::SendCtrlKey(0x43)
        Write-Output $result
    }
    if ($cmd -eq "V") { 
        $result = [KeyboardSimulator]::SendCtrlKey(0x56)
        Write-Output $result
    }
}
`

  workerReady = false

  psWorker = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], { 
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  psWorker.on('exit', () => {
    psWorker = null
    workerReady = false
    workerReadyPromise = null
  })

  workerReadyPromise = new Promise<void>((resolve) => {
    const readyListener = (data: Buffer) => {
      const output = data.toString()

      if (output.includes('READY') || output.includes('COMPILE_ERROR')) {
        workerReady = true
        psWorker?.stdout?.off('data', readyListener)
        resolve()
      }
    }
    psWorker?.stdout?.on('data', readyListener)

    setTimeout(() => {
      if (!workerReady) {
        psWorker?.stdout?.off('data', readyListener)
        workerReady = true
        resolve()
      }
    }, TIMING.WORKER_READY_TIMEOUT)
  })

  psWorker.stdin?.write(psScript + '\n')

  return { worker: psWorker, ready: workerReadyPromise }
}

const sendCommand = async (cmd: 'R' | 'C' | 'V'): Promise<string> => {
  const { worker, ready } = getWorker()
  await ready

  return new Promise<string>((resolve) => {
    const listener = (data: Buffer) => {
      const output = data.toString().trim()
      if (output.includes('OK') || output.includes('ERR') || output.includes('RELEASED')) {
        worker.stdout?.off('data', listener)
        resolve(output)
      }
    }

    worker.stdout?.on('data', listener)
    worker.stdin?.write(`${cmd}\n`)

    setTimeout(() => {
      worker.stdout?.off('data', listener)
      resolve('TIMEOUT')
    }, TIMING.COMMAND_TIMEOUT)
  })
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// --- MAIN LOGIC ---

const createResult = (
  input: string,
  output: string,
  pasted: boolean,
  startTime: number,
  error?: string,
  apiMs?: number,
  clipboardMs?: number,
  pasteMs?: number
): TranslyResult => ({
  input,
  output,
  pasted,
  error,
  timing: {
    totalMs: Date.now() - startTime,
    apiMs,
    clipboardMs,
    pasteMs
  }
})

export const correctFromActiveSelection = async (): Promise<TranslyResult> => {
  const startTime = Date.now()

  clipboard.writeText('')
  await sleep(TIMING.CLEAR_DELAY)

  try {
    await sleep(TIMING.HOTKEY_RELEASE)
    await sendCommand('R')
    await sleep(TIMING.MODIFIER_RELEASE_WAIT)

    const copyResult = await sendCommand('C')
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
      text: { verbosity: 'low' }
    } as any)
    const apiMs = Date.now() - apiStart

    const corrected = response.output_text?.trim()

    if (!corrected) {
      return createResult(copiedText, '', false, startTime, 'API returned empty', apiMs, clipboardMs)
    }

    const pasteStart = Date.now()
    clipboard.writeText(corrected)
    await sleep(TIMING.PASTE_DELAY)
    await sendCommand('V')
    const pasteMs = Date.now() - pasteStart

    return createResult(copiedText, corrected, true, startTime, undefined, apiMs, clipboardMs, pasteMs)

  } catch (err) {
    return createResult('', '', false, startTime, err instanceof Error ? err.message : 'Unknown error')
  }
}

// Pre-warm the worker
getWorker()