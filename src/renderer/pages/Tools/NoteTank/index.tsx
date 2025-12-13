import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Note } from '@shared/types'

const NoteTank = () => {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [status, setStatus] = useState('Loading notes...')

  const fetchNotes = useCallback(async () => {
    try {
      const data = await window.irodori.notes.list()
      setNotes(data)
      setStatus(`${data.length} notes loaded`)
    } catch (error) {
      console.error('Failed to fetch notes', error)
      setStatus('Failed to load notes')
    }
  }, [])

  useEffect(() => {
    fetchNotes()
    window.irodori.onNotesChanged(fetchNotes)
  }, [fetchNotes])

  return (
    <div className="overlay-shell transly-shell">
      <div className="overlay-header">
        <div>
          <div className="overlay-title">NoteTank - Debug</div>
          <p className="muted small-text">
            Toggle NoteTank to show the overlay. Press Shift+Alt+N to add a new note.
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
            <span className="pill small-pill">Shift+Alt+N</span>
          </div>
          <p className="muted small-text">
            Opens a new note editor popup. Active when NoteTank is toggled on.
          </p>
        </div>

        <div className="transly-card">
          <div className="card-row">
            <h3>Search</h3>
            <span className="pill small-pill">Ctrl+F</span>
          </div>
          <p className="muted small-text">
            In the overlay, press Ctrl+F to search notes by title or content.
          </p>
        </div>

        <div className="transly-card">
          <div className="card-row">
            <h3>Notes Overview</h3>
            <span className="pill small-pill">{notes.length} total</span>
          </div>
          {notes.length === 0 ? (
            <p className="muted">No notes yet.</p>
          ) : (
            <div className="result-grid">
              {notes.slice(0, 6).map((note) => (
                <div key={note.id}>
                  <p className="muted small-text">{new Date(note.updatedAt).toLocaleDateString()}</p>
                  <div className="result-chip">{note.title || 'Untitled'}</div>
                </div>
              ))}
              {notes.length > 6 && (
                <div>
                  <p className="muted small-text">And more...</p>
                  <div className="result-chip">+{notes.length - 6} notes</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="transly-card">
          <div className="card-row">
            <h3>Sync</h3>
            <span className="pill small-pill">REST</span>
          </div>
          <p className="muted small-text">
            Notes sync to the configured API server when online. Offline changes are queued and pushed in the background.
          </p>
        </div>
      </div>
    </div>
  )
}

export default NoteTank
