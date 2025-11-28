import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { Note } from '@shared/types'

const NoteTankOverlay = () => {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    setIsLoading(true)
    const data = await window.irodori.notes.list()
    setNotes(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchNotes()
    window.irodori.onNotesChanged(fetchNotes)
  }, [fetchNotes])

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setIsSearching(true)
      }
      if (e.key === 'Escape' && isSearching) {
        setIsSearching(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearching])

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes
    const query = searchQuery.toLowerCase()
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
    )
  }, [notes, searchQuery])

  const handleAddNote = () => {
    window.irodori.noteEditor.open()
  }

  const handleEditNote = (noteId: string) => {
    window.irodori.noteEditor.open(noteId)
  }

  const handleDeleteNote = async (noteId: string) => {
    await window.irodori.notes.remove(noteId)
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    if (expandedNoteId === noteId) setExpandedNoteId(null)
  }

  const toggleExpand = (noteId: string) => {
    setExpandedNoteId((prev) => (prev === noteId ? null : noteId))
  }

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearching(false)
      setSearchQuery('')
    }
  }

  return (
    <div className="overlay-shell notetank-shell">
      <div className="overlay-topbar" title="Drag to move">
        <div className="grip-dots"><span /><span /><span /></div>
        <span className="topbar-label">Drag to move</span>
      </div>
      <div className="overlay-header">
        <div className="overlay-title">NoteTank</div>
        <div className="pill-row">
          <div className="pill no-drag">{filteredNotes.length} notes</div>
          <button className="small-button no-drag" onClick={handleAddNote}>+ Add</button>
        </div>
      </div>

      {isSearching && (
        <div className="search-bar no-drag">
          <input
            type="text"
            placeholder="Search notes... (Esc to close)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />
        </div>
      )}

      {!isSearching && (
        <p className="muted small-text search-hint no-drag">Press Ctrl+F to search</p>
      )}

      <div className="note-list">
        {isLoading && <p className="muted">Loading...</p>}
        {!isLoading && filteredNotes.length === 0 && (
          <p className="muted">
            {searchQuery ? 'No matching notes.' : 'No notes yet. Press Shift+Alt+N to add one.'}
          </p>
        )}
        {filteredNotes.map((note) => (
          <div
            key={note.id}
            className={`note-card no-drag ${expandedNoteId === note.id ? 'expanded' : ''}`}
          >
            <div className="note-card-header" onClick={() => toggleExpand(note.id)}>
              <div className="note-title">{note.title || 'Untitled'}</div>
              <div className="note-actions">
                <button
                  className="small-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditNote(note.id)
                  }}
                >
                  Edit
                </button>
                <button
                  className="small-button danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteNote(note.id)
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            {expandedNoteId === note.id && (
              <div className="note-content">
                <p>{note.content || 'No content'}</p>
              </div>
            )}
            <div className="note-meta muted small-text">
              {new Date(note.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NoteTankOverlay
