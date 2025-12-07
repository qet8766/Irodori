import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ToolToggleCard from '@renderer/components/ToolToggleCard'
import useToolStore from '@renderer/store/tools'

const Launcher = () => {
  const { activeTools, toggleTool } = useToolStore()
  const navigate = useNavigate()
  const [apiUrl, setApiUrl] = useState('')
  const [syncStatus, setSyncStatus] = useState<{ isOnline: boolean; pendingCount: number; lastSyncAt: number } | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    window.irodori.settings.getApiUrl().then(setApiUrl)
    window.irodori.settings.getSyncStatus().then(setSyncStatus)

    const interval = setInterval(() => {
      window.irodori.settings.getSyncStatus().then(setSyncStatus)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleSaveApiUrl = async () => {
    await window.irodori.settings.setApiUrl(apiUrl)
    await window.irodori.settings.triggerSync()
    const status = await window.irodori.settings.getSyncStatus()
    setSyncStatus(status)
  }

  return (
    <div className="launcher-shell">
      <div className="hero">
        <h1>Irodori</h1>
        <div className="badge">Tools deck</div>
        <button
          className="settings-toggle"
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: '#cdd6f4' }}
        >
          {showSettings ? '×' : '⚙'}
        </button>
      </div>

      {showSettings && (
        <div className="settings-panel" style={{ background: '#1e1e2e', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#cdd6f4' }}>Server Settings</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://your-nas-ip:3456"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #45475a',
                background: '#313244',
                color: '#cdd6f4',
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={handleSaveApiUrl}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#89b4fa',
                color: '#1e1e2e',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Save & Sync
            </button>
          </div>
          {syncStatus && (
            <div style={{ fontSize: 12, color: '#a6adc8' }}>
              <span style={{ color: syncStatus.isOnline ? '#a6e3a1' : '#f38ba8' }}>
                {syncStatus.isOnline ? '● Online' : '● Offline'}
              </span>
              {syncStatus.pendingCount > 0 && (
                <span style={{ marginLeft: 12 }}>
                  {syncStatus.pendingCount} pending changes
                </span>
              )}
              {syncStatus.lastSyncAt > 0 && (
                <span style={{ marginLeft: 12 }}>
                  Last sync: {new Date(syncStatus.lastSyncAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card-grid">
        <ToolToggleCard
          title="TooDoo"
          isActive={Boolean(activeTools.TooDoo)}
          onToggle={() => toggleTool('TooDoo')}
        />

        <div className="tool-card">
          <div className="tool-card-header">
            <h3>Transly</h3>
            <span className="tag">Clipboard helper</span>
          </div>
          <p className="muted">Press Shift+Alt+T to auto-copy selection, fix the word, and paste the correction back.</p>
          <div className="tool-footer">
            <button
              className={`button ${activeTools.Transly ? 'button-ghost' : ''}`}
              type="button"
              onClick={() => toggleTool('Transly')}
            >
              {activeTools.Transly ? 'Deactivate hotkey' : 'Activate hotkey'}
            </button>
            <button className="small-button" type="button" onClick={() => navigate('/transly')}>
              Debug window
            </button>
          </div>
          <div className="muted small-text">Starts with Ctrl+C automatically when Shift+Alt+T fires.</div>
        </div>

        <div className="tool-card">
          <div className="tool-card-header">
            <h3>NoteTank</h3>
            <span className="tag">Memo app</span>
          </div>
          <p className="muted">Simple memo application. Press Shift+Alt+N to quickly add notes.</p>
          <div className="tool-footer">
            <button
              className={`button ${activeTools.NoteTank ? 'button-ghost' : ''}`}
              type="button"
              onClick={() => toggleTool('NoteTank')}
            >
              {activeTools.NoteTank ? 'Hide overlay' : 'Show overlay'}
            </button>
            <button className="small-button" type="button" onClick={() => navigate('/notetank-debug')}>
              Debug window
            </button>
          </div>
          <div className="muted small-text">Use Ctrl+F in overlay to search notes. Syncs to NAS server.</div>
        </div>

        <div className="tool-card">
          <div className="tool-card-header">
            <h3>Airu</h3>
            <span className="tag">LLM assistant</span>
          </div>
          <p className="muted">Quick LLM prompt tool. Press Shift+Alt+A to open popup, select provider and prompt.</p>
          <div className="tool-footer">
            <button
              className={`button ${activeTools.Airu ? 'button-ghost' : ''}`}
              type="button"
              onClick={() => toggleTool('Airu')}
            >
              {activeTools.Airu ? 'Deactivate hotkey' : 'Activate hotkey'}
            </button>
            <button className="small-button" type="button" onClick={() => navigate('/airu')}>
              Debug window
            </button>
          </div>
          <div className="muted small-text">Supports OpenAI GPT. Gemini and Claude coming soon.</div>
        </div>
      </div>
    </div>
  )
}

export default Launcher
