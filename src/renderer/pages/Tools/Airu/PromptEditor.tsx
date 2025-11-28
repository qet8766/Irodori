import { useEffect, useState, type KeyboardEvent, type ChangeEvent } from 'react'
import type { AiruPrompt } from '@shared/types'

const PromptEditor = () => {
  const [prompts, setPrompts] = useState<AiruPrompt[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const loadPrompts = async () => {
    const list = await window.irodori.airu.prompts.list()
    setPrompts(list)
  }

  useEffect(() => {
    loadPrompts()
    window.irodori.airu.onPromptsChanged(loadPrompts)
  }, [])

  const handleClose = () => {
    window.irodori.airu.closePromptEditor()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      if (isAdding) {
        setIsAdding(false)
        setNewTitle('')
        setNewContent('')
      } else if (editingId) {
        setEditingId(null)
      } else {
        handleClose()
      }
    }
  }

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    const id = crypto.randomUUID()
    await window.irodori.airu.prompts.add({ id, title: newTitle.trim(), content: newContent.trim() })
    setIsAdding(false)
    setNewTitle('')
    setNewContent('')
    await loadPrompts()
  }

  const handleStartEdit = (prompt: AiruPrompt) => {
    setEditingId(prompt.id)
    setEditTitle(prompt.title)
    setEditContent(prompt.content)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return
    await window.irodori.airu.prompts.update({
      id: editingId,
      title: editTitle.trim(),
      content: editContent.trim(),
    })
    setEditingId(null)
    await loadPrompts()
  }

  const handleDelete = async (id: string) => {
    await window.irodori.airu.prompts.remove(id)
    await loadPrompts()
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newOrder = [...prompts]
    const [moved] = newOrder.splice(index, 1)
    newOrder.splice(index - 1, 0, moved)
    await window.irodori.airu.prompts.reorder(newOrder.map((p) => p.id))
    await loadPrompts()
  }

  const handleMoveDown = async (index: number) => {
    if (index === prompts.length - 1) return
    const newOrder = [...prompts]
    const [moved] = newOrder.splice(index, 1)
    newOrder.splice(index + 1, 0, moved)
    await window.irodori.airu.prompts.reorder(newOrder.map((p) => p.id))
    await loadPrompts()
  }

  return (
    <div className="prompt-editor-shell" onKeyDown={handleKeyDown}>
      <div className="prompt-editor-header">
        <span className="overlay-title">Edit Prompts</span>
        <button className="small-button" onClick={handleClose}>
          Close
        </button>
      </div>

      <div className="prompt-list">
        {prompts.map((prompt, idx) => (
          <div key={prompt.id} className="prompt-card">
            {editingId === prompt.id ? (
              <div className="prompt-edit-form">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  className="edit-input"
                />
                <textarea
                  value={editContent}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                  placeholder="Prompt content (use {{input}} for user input)"
                  className="edit-textarea"
                  rows={3}
                />
                <div className="prompt-actions">
                  <button className="small-button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button className="button" onClick={handleSaveEdit}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="prompt-card-header">
                  <span className="prompt-title">{prompt.title}</span>
                  <div className="prompt-actions">
                    <button
                      className="small-button"
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="small-button"
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === prompts.length - 1}
                    >
                      ↓
                    </button>
                    <button className="small-button" onClick={() => handleStartEdit(prompt)}>
                      Edit
                    </button>
                    <button className="small-button danger" onClick={() => handleDelete(prompt.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                <p className="muted small-text prompt-preview">
                  {prompt.content.length > 100 ? prompt.content.slice(0, 100) + '...' : prompt.content}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="prompt-add-form">
          <input
            type="text"
            value={newTitle}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)}
            placeholder="Prompt title"
            className="edit-input"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewContent(e.target.value)}
            placeholder="Prompt content (use {{input}} for user input)"
            className="edit-textarea"
            rows={3}
          />
          <div className="prompt-actions">
            <button
              className="small-button"
              onClick={() => {
                setIsAdding(false)
                setNewTitle('')
                setNewContent('')
              }}
            >
              Cancel
            </button>
            <button className="button" onClick={handleAdd} disabled={!newTitle.trim()}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button className="button add-prompt-btn" onClick={() => setIsAdding(true)}>
          + Add Prompt
        </button>
      )}
    </div>
  )
}

export default PromptEditor
