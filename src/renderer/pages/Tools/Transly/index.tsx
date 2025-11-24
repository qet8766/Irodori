import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type TranslyResult = {
  input: string
  output: string
  pasted: boolean
  error?: string
  timing?: { totalMs: number; copyMs?: number; apiMs?: number; pasteMs?: number }
}

const Transly = () => {
  const navigate = useNavigate()
  const [lastResult, setLastResult] = useState<TranslyResult | null>(null)
  const [status, setStatus] = useState('Waiting for Shift+Alt+T…')
  const [manualRunning, setManualRunning] = useState(false)

  useEffect(() => {
    window.irodori.onTranslyResult((payload) => {
      setLastResult(payload)
      setStatus(payload.error ? `Error: ${payload.error}` : 'Hotkey run completed.')
    })
  }, [])

  const handleManualRun = async () => {
    setManualRunning(true)
    const word = window.irodori.clipboard.readText()
    const result = await window.irodori.transly.correctWord(word, true)
    setLastResult(result)
    setStatus(result.error ? `Error: ${result.error}` : 'Manual run completed.')
    setManualRunning(false)
  }

  return (
    <div className="overlay-shell transly-shell">
      <div className="overlay-header">
        <div>
          <div className="overlay-title">Transly · Debug</div>
          <p className="muted small-text">
            Toggle Transly from the main menu, then press Shift+Alt+T anywhere. I will issue Ctrl+C, fix the word with
            OpenAI, copy the correction, and paste it back.
          </p>
        </div>
        <div className="pill-row">
          <div className="pill">{status}</div>
          <button className="small-button" type="button" onClick={() => navigate('/')}>
            Back
          </button>
        </div>
      </div>

      <div className="transly-grid">
        <div className="transly-card">
          <div className="card-row">
            <h3>Hotkey</h3>
            <span className="pill small-pill">Shift+Alt+T</span>
          </div>
          <p className="muted small-text">
            Active only when Transly is toggled on from the main menu. Works best if a single word is selected.
          </p>
          <div className="transly-controls">
            <div className="transly-toggle">
              <div>
                <p className="muted small-text">Manual check</p>
                <strong>Use current clipboard</strong>
              </div>
              <button className="small-button" type="button" onClick={handleManualRun} disabled={manualRunning}>
                {manualRunning ? 'Working…' : 'Run now'}
              </button>
            </div>
          </div>
        </div>

        <div className="transly-card">
          <div className="card-row">
            <h3>Last action</h3>
            {lastResult ? <span className="pill small-pill">{lastResult.pasted ? 'Pasted' : 'Copied only'}</span> : null}
          </div>

          {lastResult ? (
            <div className="result-grid">
              <div>
                <p className="muted small-text">Clipboard word</p>
                <div className="result-chip">{lastResult.input}</div>
              </div>
              <div>
                <p className="muted small-text">Transly output</p>
                <div className="result-chip highlight">{lastResult.output}</div>
              </div>
              {lastResult.timing ? (
                <>
                  <div>
                    <p className="muted small-text">Total</p>
                    <div className="result-chip">{lastResult.timing.totalMs ?? 0} ms</div>
                  </div>
                  <div>
                    <p className="muted small-text">Copy / API / Paste</p>
                    <div className="result-chip">
                      {(lastResult.timing.copyMs ?? 0)} / {(lastResult.timing.apiMs ?? 0)} / {(lastResult.timing.pasteMs ?? 0)} ms
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <p className="muted">No corrections yet.</p>
          )}

          {lastResult?.error ? <p className="muted error-text">Error: {lastResult.error}</p> : null}
        </div>
      </div>
    </div>
  )
}

export default Transly
