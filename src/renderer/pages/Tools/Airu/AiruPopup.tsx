import { useEffect, useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react'
import type { AiruProvider, AiruPrompt, AiruResult } from '@shared/types'

type Step = 'provider' | 'prompt' | 'input' | 'result'

const AiruPopup = () => {
  const [step, setStep] = useState<Step>('provider')
  const [provider, setProvider] = useState<AiruProvider | null>(null)
  const [prompts, setPrompts] = useState<AiruPrompt[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState<AiruPrompt | null>(null)
  const [userInput, setUserInput] = useState('')
  const [result, setResult] = useState<AiruResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load prompts on mount
  useEffect(() => {
    window.irodori.airu.prompts.list().then(setPrompts)
  }, [])

  // Focus management
  useEffect(() => {
    if (step === 'provider' || step === 'prompt') {
      listRef.current?.querySelector('button')?.focus()
    } else if (step === 'input') {
      inputRef.current?.focus()
    }
  }, [step])

  const handleClose = () => {
    window.irodori.airu.close()
  }

  const handleSelectProvider = (p: AiruProvider) => {
    setProvider(p)
    setStep('prompt')
    setSelectedIndex(0)
  }

  const handleSelectPrompt = (prompt: AiruPrompt) => {
    setSelectedPrompt(prompt)
    setStep('input')
  }

  const handleEditPrompts = () => {
    window.irodori.airu.openPromptEditor()
  }

  const handleSend = async () => {
    if (!provider || !selectedPrompt || !userInput.trim()) return

    setLoading(true)
    try {
      const res = await window.irodori.airu.execute(provider, selectedPrompt.id, userInput.trim())
      setResult(res)
      setStep('result')
    } catch (err) {
      setResult({
        provider,
        promptTitle: selectedPrompt.title,
        promptContent: selectedPrompt.content,
        userInput,
        fullRequest: '',
        response: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
      setStep('result')
    }
    setLoading(false)
  }

  const handlePaste = () => {
    if (result?.response) {
      window.irodori.airu.paste(result.response)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      if (step === 'result') {
        handleClose()
      } else if (step === 'input') {
        setStep('prompt')
        setSelectedIndex(0)
      } else if (step === 'prompt') {
        setStep('provider')
        setSelectedIndex(0)
      } else {
        handleClose()
      }
      return
    }

    if (step === 'provider') {
      const providers: AiruProvider[] = ['openai', 'gemini', 'claude']
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, providers.length - 1))
        const buttons = listRef.current?.querySelectorAll('button')
        buttons?.[Math.min(selectedIndex + 1, providers.length - 1)]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        const buttons = listRef.current?.querySelectorAll('button')
        buttons?.[Math.max(selectedIndex - 1, 0)]?.focus()
      } else if (e.key >= '1' && e.key <= '3') {
        const idx = parseInt(e.key) - 1
        if (idx < providers.length) {
          handleSelectProvider(providers[idx])
        }
      }
    } else if (step === 'prompt') {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, prompts.length))
        const buttons = listRef.current?.querySelectorAll('button')
        buttons?.[Math.min(selectedIndex + 1, prompts.length)]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        const buttons = listRef.current?.querySelectorAll('button')
        buttons?.[Math.max(selectedIndex - 1, 0)]?.focus()
      } else if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1
        if (idx < prompts.length) {
          handleSelectPrompt(prompts[idx])
        }
      }
    } else if (step === 'input') {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        handleSend()
      }
    }
  }

  const providerLabels: Record<AiruProvider, { name: string; available: boolean }> = {
    openai: { name: 'GPT (OpenAI)', available: true },
    gemini: { name: 'Gemini (Google)', available: false },
    claude: { name: 'Claude (Anthropic)', available: false },
  }

  return (
    <div className="airu-popup-shell" onKeyDown={handleKeyDown}>
      {step === 'provider' && (
        <>
          <div className="airu-header">
            <span className="airu-title">Choose Provider</span>
            <span className="muted small-text">ESC to close</span>
          </div>
          <ul ref={listRef} className="airu-list">
            {(['openai', 'gemini', 'claude'] as AiruProvider[]).map((p, idx) => (
              <li key={p}>
                <button
                  className={`airu-option-item ${!providerLabels[p].available ? 'disabled' : ''}`}
                  onClick={() => providerLabels[p].available && handleSelectProvider(p)}
                  disabled={!providerLabels[p].available}
                >
                  <span className="option-number">{idx + 1}</span>
                  <span className="option-text">
                    {providerLabels[p].name}
                    {!providerLabels[p].available && <span className="soon-badge">soon</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 'prompt' && (
        <>
          <div className="airu-header">
            <span className="airu-title">Select Prompt</span>
            <span className="muted small-text">ESC to go back</span>
          </div>
          <ul ref={listRef} className="airu-list">
            {prompts.map((prompt, idx) => (
              <li key={prompt.id}>
                <button
                  className="airu-option-item"
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  <span className="option-number">{idx + 1}</span>
                  <span className="option-text">{prompt.title}</span>
                </button>
              </li>
            ))}
            <li>
              <button className="airu-option-item edit-btn" onClick={handleEditPrompts}>
                <span className="option-text">Edit Prompts...</span>
              </button>
            </li>
          </ul>
          {prompts.length === 0 && (
            <p className="muted small-text" style={{ padding: '0 10px' }}>
              No prompts yet. Click "Edit Prompts" to add one.
            </p>
          )}
        </>
      )}

      {step === 'input' && (
        <>
          <div className="airu-header">
            <span className="airu-title">{selectedPrompt?.title}</span>
            <span className="muted small-text">Ctrl+Enter to send</span>
          </div>
          <div className="airu-input-area">
            <textarea
              ref={inputRef}
              className="airu-textarea"
              placeholder="Type your instruction..."
              value={userInput}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setUserInput(e.target.value)}
              rows={4}
            />
            <div className="airu-actions">
              <button className="small-button" onClick={() => setStep('prompt')}>
                Back
              </button>
              <button
                className="button"
                onClick={handleSend}
                disabled={loading || !userInput.trim()}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 'result' && (
        <>
          <div className="airu-header">
            <span className="airu-title">Response</span>
            {result?.timing && (
              <span className="muted small-text">{result.timing.totalMs}ms</span>
            )}
          </div>
          <div className="airu-result-area">
            {result?.error ? (
              <p className="error-text">{result.error}</p>
            ) : (
              <div className="airu-response">{result?.response}</div>
            )}
            <div className="airu-actions">
              <button className="small-button" onClick={handleClose}>
                Close
              </button>
              {!result?.error && (
                <button className="button" onClick={handlePaste}>
                  Paste
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AiruPopup
