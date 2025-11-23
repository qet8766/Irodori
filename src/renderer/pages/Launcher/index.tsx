import ToolToggleCard from '@renderer/components/ToolToggleCard'
import useToolStore from '@renderer/store/tools'

const Launcher = () => {
  const { activeTools, toggleTool } = useToolStore()

  return (
    <div className="launcher-shell">
      <div className="hero">
        <div>
          <h1>Irodori Platform</h1>
          <p>Launch and pin the tools you invent. Built with Electron, Vite, and a glassy UI.</p>
        </div>
        <div className="badge">Early build · Electron + Vite</div>
      </div>

      <div className="card-grid">
        <ToolToggleCard
          title="TooDoo overlay"
          description="Always-on-top todo widget with offline-first storage and queueing."
          badge="Always on top · Offline-first"
          isActive={Boolean(activeTools.TooDoo)}
          onToggle={() => toggleTool('TooDoo')}
        />

        <div className="tool-card">
          <h3>Upcoming slot</h3>
          <p>Reserve this space for the next Irodori idea. Toggle-ready when you are.</p>
          <div className="tool-footer">
            <span className="tag">Coming soon</span>
            <button className="button button-ghost" disabled>
              Idle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Launcher
