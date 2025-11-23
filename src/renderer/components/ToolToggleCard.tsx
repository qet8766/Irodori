type ToolToggleCardProps = {
  title: string
  description?: string
  badge?: string
  isActive: boolean
  onToggle: () => void
}

const ToolToggleCard = ({ title, description, badge, isActive, onToggle }: ToolToggleCardProps) => {
  return (
    <div className="tool-card">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      <div className="tool-footer">
        <span className="tag">{isActive ? 'Active' : 'Sleeping'}</span>
        <button className={`button ${isActive ? 'button-ghost' : ''}`} onClick={onToggle}>
          {isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
      {badge ? <div className="muted">{badge}</div> : null}
    </div>
  )
}

export default ToolToggleCard
