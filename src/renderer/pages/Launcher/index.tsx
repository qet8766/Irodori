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
            <h3>Translater</h3>
            <span className="tag">Placeholder</span>
          </div>
          <div className="tool-footer">
            <button className="button button-ghost" type="button" onClick={() => navigate('/translater')}>
              Open placeholder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Launcher
