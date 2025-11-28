import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AiruResult, AiruSettings } from '@shared/types'
import { DEFAULT_AIRU_SETTINGS } from '@shared/types'

const AiruDebug = () => {
  const navigate = useNavigate()
  const [lastResult, setLastResult] = useState<AiruResult | null>(null)
  const [settings, setSettings] = useState<AiruSettings>(DEFAULT_AIRU_SETTINGS)
  const [settingsExpanded, setSettingsExpanded] = useState(false)

  useEffect(() => {
    // Load settings
    window.irodori.airu.settings.get().then(setSettings)

    // Listen for results
    window.irodori.airu.onResult((payload: AiruResult) => {
      setLastResult(payload)
    })
  }, [])

  const handleSettingChange = (key: keyof AiruSettings, value: string | number) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    window.irodori.airu.settings.set({ [key]: value })
  }

  return (
    <div className="overlay-shell airu-debug-shell">
      <div className="overlay-header">
        <div>
          <div className="overlay-title">Airu · Debug</div>
          <p className="muted small-text">
            Toggle Airu, then press Shift+Alt+A to open the popup.
          </p>
        </div>
        <div className="pill-row">
          <button className="small-button" type="button" onClick={() => navigate('/')}>
            Back
          </button>
        </div>
      </div>

      <div className="airu-debug-grid">
        {/* Settings Card */}
        <div className="transly-card">
          <div className="card-row">
            <h3>API Settings</h3>
            <button
              className="small-button"
              onClick={() => setSettingsExpanded(!settingsExpanded)}
            >
              {settingsExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {settingsExpanded && (
            <div className="settings-form">
              <div className="settings-section">
                <h4>OpenAI</h4>
                <div className="setting-row">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={settings.openaiApiKey || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('openaiApiKey', e.target.value)
                    }
                    placeholder="sk-..."
                  />
                </div>
                <div className="setting-row">
                  <label>Model</label>
                  <select
                    value={settings.openaiModel}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      handleSettingChange('openaiModel', e.target.value)
                    }
                  >
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="gpt-4">gpt-4</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  </select>
                </div>
                <div className="setting-row">
                  <label>Temperature ({settings.openaiTemperature})</label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.openaiTemperature}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('openaiTemperature', parseFloat(e.target.value))
                    }
                  />
                </div>
                <div className="setting-row">
                  <label>Max Tokens</label>
                  <input
                    type="number"
                    min="1"
                    max="128000"
                    value={settings.openaiMaxTokens}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('openaiMaxTokens', parseInt(e.target.value) || 4096)
                    }
                  />
                </div>
                <div className="setting-row">
                  <label>Top P ({settings.openaiTopP})</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.openaiTopP}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('openaiTopP', parseFloat(e.target.value))
                    }
                  />
                </div>
                <div className="setting-row">
                  <label>Frequency Penalty ({settings.openaiFrequencyPenalty})</label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={settings.openaiFrequencyPenalty}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('openaiFrequencyPenalty', parseFloat(e.target.value))
                    }
                  />
                </div>
                <div className="setting-row">
                  <label>Presence Penalty ({settings.openaiPresencePenalty})</label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={settings.openaiPresencePenalty}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('openaiPresencePenalty', parseFloat(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="settings-section">
                <h4>Gemini (Coming Soon)</h4>
                <div className="setting-row">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={settings.geminiApiKey || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('geminiApiKey', e.target.value)
                    }
                    placeholder="Not implemented yet"
                    disabled
                  />
                </div>
              </div>

              <div className="settings-section">
                <h4>Claude (Coming Soon)</h4>
                <div className="setting-row">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={settings.claudeApiKey || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleSettingChange('claudeApiKey', e.target.value)
                    }
                    placeholder="Not implemented yet"
                    disabled
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hotkey Info Card */}
        <div className="transly-card">
          <div className="card-row">
            <h3>Hotkey</h3>
            <span className="pill small-pill">Shift+Alt+A</span>
          </div>
          <p className="muted small-text">
            Active only when Airu is toggled on. Opens a popup to select provider, prompt, and enter your instruction.
          </p>
        </div>

        {/* Last Result Card */}
        <div className="transly-card">
          <div className="card-row">
            <h3>Last Request</h3>
            {lastResult && (
              <span className="pill small-pill">{lastResult.provider}</span>
            )}
          </div>

          {lastResult ? (
            <div className="result-grid">
              <div>
                <p className="muted small-text">Prompt</p>
                <div className="result-chip">{lastResult.promptTitle}</div>
              </div>
              <div>
                <p className="muted small-text">User Input</p>
                <div className="result-chip">{lastResult.userInput}</div>
              </div>
              {lastResult.timing?.totalMs && (
                <>
                  <div>
                    <p className="muted small-text">Total Time</p>
                    <div className="result-chip">{lastResult.timing.totalMs} ms</div>
                  </div>
                  {lastResult.timing.apiMs && (
                    <div>
                      <p className="muted small-text">API Time</p>
                      <div className="result-chip highlight">{lastResult.timing.apiMs} ms</div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="muted">No requests yet.</p>
          )}

          {lastResult?.error && <p className="muted error-text">Error: {lastResult.error}</p>}
        </div>

        {/* Full Request Debug Card */}
        {lastResult && (
          <div className="transly-card">
            <h3>Full Request</h3>
            <div className="debug-code-block">
              <pre>{lastResult.fullRequest}</pre>
            </div>
          </div>
        )}

        {/* Full Response Debug Card */}
        {lastResult && !lastResult.error && (
          <div className="transly-card">
            <h3>Full Response</h3>
            <div className="debug-code-block">
              <pre>{lastResult.response}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AiruDebug
