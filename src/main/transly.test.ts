import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import type { TranslyResult } from './transly'

// Mock dependencies
jest.mock('node:child_process')
jest.mock('openai')
jest.mock('./electron')

import { spawn } from 'node:child_process'
import OpenAI from 'openai'
import { clipboard } from './electron'

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>
const mockClipboard = clipboard as jest.Mocked<typeof clipboard>

describe('transly.ts Edge Cases', () => {
  let translyModule: typeof import('./transly')
  let mockWorker: any
  let mockOpenAIClient: any

  beforeEach(async () => {
    jest.clearAllMocks()

    // Setup mock worker
    mockWorker = {
      stdin: {
        write: jest.fn()
      },
      stdout: {
        on: jest.fn(),
        off: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn(),
      killed: false
    }

    // Setup OpenAI mock
    mockOpenAIClient = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }

    mockSpawn.mockReturnValue(mockWorker as any)

    // Mock OpenAI constructor
    ;(OpenAI as any).mockImplementation(() => mockOpenAIClient)

    // Default clipboard mock
    mockClipboard.writeText = jest.fn()
    mockClipboard.readText = jest.fn().mockReturnValue('')

    // Reset module cache and reload
    jest.resetModules()
    translyModule = await import('./transly')
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Edge Case: Empty Clipboard After Copy', () => {
    it('should handle clipboard remaining empty after copy attempt', async () => {
      // Simulate worker ready
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      // Clipboard stays empty
      mockClipboard.readText.mockReturnValue('')

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.pasted).toBe(false)
      expect(result.error).toMatch(/Copy failed/)
      expect(result.input).toBe('')
    })
  })

  describe('Edge Case: API Returns Empty Response', () => {
    it('should handle API returning null/undefined content', async () => {
      // Simulate worker ready
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      // Clipboard has text
      mockClipboard.readText.mockReturnValue('test text')

      // API returns empty
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }]
      })

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.pasted).toBe(false)
      expect(result.error).toBe('API returned empty')
      expect(result.input).toBe('test text')
    })

    it('should handle API returning empty string', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      mockClipboard.readText.mockReturnValue('test text')

      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '   ' } }]
      })

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.pasted).toBe(false)
      expect(result.error).toBe('API returned empty')
    })
  })

  describe('Edge Case: API Throws Error', () => {
    it('should handle API network errors gracefully', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      mockClipboard.readText.mockReturnValue('test text')

      const apiError = new Error('Network timeout')
      mockOpenAIClient.chat.completions.create.mockRejectedValue(apiError)

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.pasted).toBe(false)
      expect(result.error).toBe('Network timeout')
      expect(result.input).toBe('')
    })

    it('should handle API rate limit errors', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      mockClipboard.readText.mockReturnValue('test text')

      const rateLimitError = new Error('Rate limit exceeded')
      mockOpenAIClient.chat.completions.create.mockRejectedValue(rateLimitError)

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.error).toBe('Rate limit exceeded')
    })
  })

  describe('Edge Case: PowerShell Worker Issues', () => {
    it('should handle worker compilation error', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('COMPILE_ERROR: Type not found\n'))
      }

      mockClipboard.readText.mockReturnValue('test')
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'test' } }]
      })

      // Should still attempt to run but may fail
      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      // Function should handle this gracefully
      expect(result).toBeDefined()
    })

    it('should handle command timeout', async () => {
      jest.useFakeTimers()

      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      // Don't respond to commands - simulate timeout
      mockWorker.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          // Only send READY, nothing else
          callback(Buffer.from('READY\n'))
        }
      })

      const resultPromise = translyModule.correctFromActiveSelection()

      jest.advanceTimersByTime(5000)

      const result = await resultPromise

      expect(result).toBeDefined()

      jest.useRealTimers()
    })
  })

  describe('Edge Case: SendInput Fails (sent=0)', () => {
    it('should detect when SendInput returns 0 (UIPI blocked)', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      // Simulate SendInput failure
      let commandCount = 0
      mockWorker.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from('READY\n'))
          // Subsequent calls return sent=0
          setTimeout(() => {
            if (commandCount++ === 0) {
              callback(Buffer.from('RELEASED:0\n'))
            } else {
              callback(Buffer.from('OK:sent=0,size=40,err=0,hwnd=12345\n'))
            }
          }, 10)
        }
      })

      mockClipboard.readText.mockReturnValue('')

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.error).toMatch(/Copy failed/)
    })
  })

  describe('Edge Case: Very Long Text', () => {
    it('should handle very long clipboard text', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      const longText = 'a'.repeat(10000)
      mockClipboard.readText.mockReturnValue(longText)

      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'corrected' } }]
      })

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.input).toBe(longText)
      expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: longText })
          ])
        })
      )
    })
  })

  describe('Edge Case: Special Characters', () => {
    it('should handle text with special characters and unicode', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      const specialText = 'こんにちは 🎉 "quotes" \'apostrophe\' \n\t special'
      mockClipboard.readText.mockReturnValue(specialText)

      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: specialText } }]
      })

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.input).toBe(specialText)
      expect(result.output).toBe(specialText)
    })
  })

  describe('Edge Case: Worker Process Dies', () => {
    it('should handle worker process exit and recreate', async () => {
      // First worker
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      // Simulate worker exit
      const exitCallback = mockWorker.on.mock.calls.find((call: any) => call[0] === 'exit')
      if (exitCallback) {
        exitCallback[1](1) // exit with code 1
      }

      mockWorker.killed = true

      // Should create new worker
      mockSpawn.mockReturnValue({
        ...mockWorker,
        killed: false
      } as any)

      mockClipboard.readText.mockReturnValue('test')
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'test' } }]
      })

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result).toBeDefined()
    })
  })

  describe('Success Case: Normal Operation', () => {
    it('should successfully correct text end-to-end', async () => {
      const stdoutOnCall = mockWorker.stdout.on.mock.calls.find((call: any) => call[0] === 'data')
      if (stdoutOnCall) {
        stdoutOnCall[1](Buffer.from('READY\n'))
      }

      // Simulate successful commands
      let commandCount = 0
      mockWorker.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from('READY\n'))
          setTimeout(() => {
            if (commandCount === 0) {
              callback(Buffer.from('RELEASED:2\n'))
              commandCount++
            } else if (commandCount === 1) {
              callback(Buffer.from('OK:sent=4,size=40,err=0,hwnd=12345\n'))
              commandCount++
            } else if (commandCount === 2) {
              callback(Buffer.from('OK:sent=4,size=40,err=0,hwnd=12345\n'))
              commandCount++
            }
          }, 10)
        }
      })

      mockClipboard.readText.mockReturnValue('teh quick')
      mockOpenAIClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'the quick' } }]
      })

      const result: TranslyResult = await translyModule.correctFromActiveSelection()

      expect(result.pasted).toBe(true)
      expect(result.input).toBe('teh quick')
      expect(result.output).toBe('the quick')
      expect(result.error).toBeUndefined()
      expect(result.timing?.totalMs).toBeGreaterThan(0)
    })
  })
})
