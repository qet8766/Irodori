import { useNavigate } from 'react-router-dom'
import ToolToggleCard from '@renderer/components/ToolToggleCard'
import useToolStore from '@renderer/store/tools'

const Launcher = () => {
  const { activeTools, toggleTool } = useToolStore()
  const navigate = useNavigate()

  return (
    <div className="launcher-shell">
      <div className="hero">
        <h1>Irodori</h1>
        <div className="badge">Tools deck</div>
      </div>

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
          <div className="muted small-text">Use Ctrl+F in overlay to search notes. Syncs to SQLite Cloud.</div>
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
