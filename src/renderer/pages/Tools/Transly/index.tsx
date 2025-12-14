import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type TranslyResult = Parameters<Parameters<typeof window.irodori.onTranslyResult>[0]>[0]
type TranslateOptionsResult = Parameters<Parameters<typeof window.irodori.onTranslateOptionsResult>[0]>[0]

const Transly = () => {
  const navigate = useNavigate()
  const [lastResult, setLastResult] = useState<TranslyResult | null>(null)
  const [lastOptionsResult, setLastOptionsResult] = useState<TranslateOptionsResult | null>(null)
  const [status, setStatus] = useState('Waiting for Shift+Alt+T…')

  useEffect(() => {
    window.irodori.onTranslyResult((payload: TranslyResult) => {
      setLastResult(payload)
      setStatus(payload.error ? `Error: ${payload.error}` : 'Hotkey run completed.')
    })
    window.irodori.onTranslateOptionsResult((payload: TranslateOptionsResult) => {
      setLastOptionsResult(payload)
      setStatus(payload.error ? `Error: ${payload.error}` : `Options received: ${payload.options.length}`)
    })
  }, [])

  return (
    <div className="overlay-shell transly-shell">
      <div className="overlay-header">
        <div>
          <div className="overlay-title">Transly · Debug</div>
          <p className="muted small-text">
            Toggle Transly, then press Shift+Alt+T. I will Auto-Copy → Fix → Auto-Paste.
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
        {/* Information Card */}
        <div className="transly-card">
          <div className="card-row">
            <h3>Hotkey</h3>
            <span className="pill small-pill">Shift+Alt+T</span>
          </div>
          <p className="muted small-text">
            Active only when Transly is toggled on. Works best if a single word is selected.
          </p>
        </div>

        {/* Result Card */}
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
              {lastResult.timing?.totalMs ? (
                <>
                  <div>
                    <p className="muted small-text">Total Time</p>
                    <div className="result-chip">{lastResult.timing.totalMs} ms</div>
                  </div>
                  {lastResult.timing.apiMs ? (
                    <div>
                      <p className="muted small-text">API Time</p>
                      <div className="result-chip highlight">{lastResult.timing.apiMs} ms</div>
                    </div>
                  ) : null}
                  {lastResult.timing.clipboardMs ? (
                    <div>
                      <p className="muted small-text">Clipboard Time</p>
                      <div className="result-chip">{lastResult.timing.clipboardMs} ms</div>
                    </div>
                  ) : null}
                  {lastResult.timing.pasteMs ? (
                    <div>
                      <p className="muted small-text">Paste Time</p>
                      <div className="result-chip">{lastResult.timing.pasteMs} ms</div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <p className="muted">No corrections yet.</p>
          )}

          {lastResult?.error ? <p className="muted error-text">Error: {lastResult.error}</p> : null}
        </div>

        {/* Translate Options Card */}
        <div className="transly-card">
          <div className="card-row">
            <h3>Translate Options</h3>
            <span className="pill small-pill">Shift+Alt+K</span>
          </div>
          <p className="muted small-text">
            Select Korean text and get multiple English translation options.
          </p>
        </div>

        {/* Translate Options Result Card */}
        <div className="transly-card">
          <div className="card-row">
            <h3>Last options</h3>
            {lastOptionsResult ? (
              <span className="pill small-pill">{lastOptionsResult.options.length} options</span>
            ) : null}
          </div>

          {lastOptionsResult ? (
            <div className="result-grid">
              <div>
                <p className="muted small-text">Input</p>
                <div className="result-chip">{lastOptionsResult.input}</div>
              </div>
              <div>
                <p className="muted small-text">Options</p>
                <div className="result-chip highlight">{lastOptionsResult.options.join(', ')}</div>
              </div>
              {lastOptionsResult.timing?.totalMs ? (
                <>
                  <div>
                    <p className="muted small-text">Total Time</p>
                    <div className="result-chip">{lastOptionsResult.timing.totalMs} ms</div>
                  </div>
                  {lastOptionsResult.timing.apiMs ? (
                    <div>
                      <p className="muted small-text">API Time</p>
                      <div className="result-chip highlight">{lastOptionsResult.timing.apiMs} ms</div>
                    </div>
                  ) : null}
                  {lastOptionsResult.timing.clipboardMs ? (
                    <div>
                      <p className="muted small-text">Clipboard Time</p>
                      <div className="result-chip">{lastOptionsResult.timing.clipboardMs} ms</div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <p className="muted">No translate options yet.</p>
          )}

          {lastOptionsResult?.error ? <p className="muted error-text">Error: {lastOptionsResult.error}</p> : null}
        </div>
      </div>
    </div>
  )
}

export default Transly
