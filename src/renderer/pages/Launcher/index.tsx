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
          title="TooDoo overlay"
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
      </div>
    </div>
  )
}

export default Launcher
