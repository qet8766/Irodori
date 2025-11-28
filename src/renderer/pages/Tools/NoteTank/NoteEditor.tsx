import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation } from 'react-router-dom'

const NoteEditor = () => {
  const location = useLocation()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const noteId = params.get('id')
  const isEditing = Boolean(noteId)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    const loadNote = async () => {
      if (!noteId) {
        setTitle('')
        setContent('')
        setStatus('')
        inputRef.current?.focus()
        return
      }

      setIsLoading(true)
      try {
        const notes = await window.irodori.notes.list()
        const note = notes.find((n) => n.id === noteId)
        if (note) {
          setTitle(note.title)
          setContent(note.content)
        } else {
          setStatus('Note not found')
        }
      } catch (error) {
        console.error('Failed to load note', error)
        setStatus('Failed to load note')
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
      }
    }

    loadNote()
  }, [noteId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setStatus('Title is required')
      return
    }

    try {
      if (isEditing && noteId) {
        await window.irodori.notes.update({
          id: noteId,
          title: trimmedTitle,
          content: content.trim(),
        })
        setStatus('Updated!')
      } else {
        await window.irodori.notes.add({
          id: crypto.randomUUID(),
          title: trimmedTitle,
          content: content.trim(),
        })
        setStatus('Added!')
      }
      window.close()
    } catch (error) {
      console.error('Failed to save note', error)
      setStatus('Failed to save note')
    }
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const handleClose = () => {
    window.close()
  }

  return (
    <div className="quick-add-shell note-editor-shell">
      <div className="quick-add-header">
        <div>
          <p className="muted">NoteTank</p>
          <h3>{isEditing ? 'Edit note' : 'New note'}</h3>
        </div>
        <button className="small-button" type="button" onClick={handleClose}>
          Close
        </button>
      </div>

      {isLoading ? (
        <p className="muted">Loading...</p>
      ) : (
        <form ref={formRef} className="input-stack" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="no-drag"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Content (Ctrl+Enter to save)"
            rows={5}
            className="no-drag"
            onKeyDown={handleTextareaKeyDown}
          />
          <button className="button" type="submit">
            {isEditing ? 'Save changes' : 'Add note'}
          </button>
        </form>
      )}

      {status && <p className="muted status-text">{status}</p>}
    </div>
  )
}

export default NoteEditor
