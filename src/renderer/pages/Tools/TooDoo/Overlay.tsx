import { useCallback, useEffect, useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import type { ProjectNote, Task, TaskCategory } from '@shared/types'

const normalCategories: { key: TaskCategory; title: string; tone: 'cyan' | 'amber' | 'violet' | 'crimson' }[] = [
  { key: 'short_term', title: 'Short-term', tone: 'cyan' },
  { key: 'long_term', title: 'Long-term', tone: 'amber' },
  { key: 'project', title: 'Projects', tone: 'violet' },
]

const immediateCategory = { key: 'immediate', title: 'Immediate', tone: 'crimson' } as const

const TooDooOverlay = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [editing, setEditing] = useState<Record<string, { title: string; description: string }>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ taskId: string | null; text: string }>({ taskId: null, text: '' })

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    const data = await window.irodori.tasks.list()
    setTasks(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
    window.irodori.onTasksChanged(fetchTasks)
  }, [fetchTasks])

  const tasksByCategory = useMemo(() => {
    const buckets: Record<TaskCategory, Task[]> = { short_term: [], long_term: [], project: [], immediate: [] }
    tasks.forEach((task) => buckets[task.category]?.push(task))
    return buckets
  }, [tasks])

  const isImmediateMode = tasksByCategory.immediate.length > 0
  const visibleCategories = isImmediateMode ? [immediateCategory] : normalCategories

  const handleDragStart = (taskId: string) => (e: DragEvent<HTMLDivElement>) => {
    setDraggingTaskId(taskId)
    e.dataTransfer?.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDropOnCategory = (category: TaskCategory) => async (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    const taskId = draggingTaskId || e.dataTransfer?.getData('text/plain')
    setDraggingTaskId(null)
    if (!taskId) return
    
    const updated = await window.irodori.tasks.update({ id: taskId, category })
    if (updated) setTasks((prev) => prev.map((item) => (item.id === taskId ? updated : item)))
  }

  const allowDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const startEdit = (task: Task) => {
    setEditing((prev) => ({ ...prev, [task.id]: { title: task.title, description: task.description ?? '' } }))
  }

  const saveEdit = async (taskId: string) => {
    const form = editing[taskId]
    if (!form) return
    const updated = await window.irodori.tasks.update({
      id: taskId,
      title: form.title,
      description: form.description.trim() ? form.description : null,
    })
    if (updated) setTasks((prev) => prev.map((item) => (item.id === taskId ? updated : item)))
    setEditing((prev) => { const next = { ...prev }; delete next[taskId]; return next })
  }

  const removeTask = async (taskId: string) => {
    await window.irodori.tasks.remove(taskId)
    setTasks((prev) => prev.filter((item) => item.id !== taskId))
  }

  const addNote = async (taskId: string, content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    const optimistic: ProjectNote = { id: crypto.randomUUID(), taskId, content: trimmed, createdAt: Date.now(), updatedAt: Date.now(), isDeleted: false }
    
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, projectNotes: [...(t.projectNotes ?? []), optimistic] } : t))
    const saved = await window.irodori.tasks.addNote(optimistic)
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, projectNotes: (t.projectNotes ?? []).map((n) => (n.id === optimistic.id ? saved : n)) } : t))
  }

  const submitNoteModal = () => {
    if (noteModal.taskId) void addNote(noteModal.taskId, noteModal.text)
    setNoteModal({ taskId: null, text: '' })
  }

  const deleteNote = async (taskId: string, noteId: string) => {
    await window.irodori.tasks.removeNote(noteId)
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, projectNotes: (t.projectNotes ?? []).filter((n) => n.id !== noteId) } : t))
  }

  // Pure deletion logic on double click
  const handleCheckboxClick = (taskId: string) => (e: MouseEvent) => {
    e.preventDefault()
    if (e.detail >= 2) void removeTask(taskId)
  }

  return (
    <div className={`overlay-shell ${isImmediateMode ? 'immediate-mode' : ''}`}>
      <div className="overlay-topbar" title="Drag to move">
        <div className="grip-dots"><span /><span /><span /></div>
        <span className="topbar-label">{isImmediateMode ? 'Immediate mode' : 'Drag to move'}</span>
      </div>
      <div className="overlay-header">
        <div className="overlay-title">{isImmediateMode ? 'Immediate focus' : 'TooDoo'}</div>
        <div className="pill-row"><div className="pill no-drag">{isImmediateMode ? 'Resolve to exit' : 'Always on top'}</div></div>
      </div>

      <div className="task-columns">
        {visibleCategories.map((cat) => {
          const list = tasksByCategory[cat.key] ?? []
          return (
            <section key={cat.key} className={`task-section tone-${cat.tone}`} onDragOver={allowDrop} onDrop={handleDropOnCategory(cat.key)}>
              <div className="section-header simple">
                <div className="section-title"><span className="section-dot" /><h3>{cat.title}</h3></div>
                <div className="count-pill">{list.length}</div>
              </div>

              {!isLoading && list.length === 0 && <p className="muted">No items yet.</p>}
              <div className="task-list">
                {list.map((task) => {
                  const form = editing[task.id]
                  return (
                    <div
                      key={task.id}
                      className={`task-card no-drag ${cat.key === 'project' ? 'project-card' : ''}`}
                      draggable={!form}
                      onDragStart={handleDragStart(task.id)}
                      onDragEnd={() => setDraggingTaskId(null)}
                    >
                      <div className="task-card-header">
                        <label className="checkbox" onClick={handleCheckboxClick(task.id)}>
                          <input type="checkbox" />
                          <span />
                        </label>
                        {form ? (
                          <div className="task-editing">
                            <input className="edit-input" value={form.title} onChange={(e) => setEditing(p => ({ ...p, [task.id]: { ...form, title: e.target.value } }))} />
                            <textarea className="edit-textarea" rows={3} value={form.description} onChange={(e) => setEditing(p => ({ ...p, [task.id]: { ...form, description: e.target.value } }))} placeholder="Description" />
                          </div>
                        ) : (
                          <div className="task-text">
                            <div className="task-title">{task.title}</div>
                            {task.description && <div className="muted small-text">{task.description}</div>}
                          </div>
                        )}
                        <div className="task-actions">
                          {form ? (
                            <><button className="small-button" onClick={() => saveEdit(task.id)}>Save</button><button className="small-button" onClick={() => setEditing(p => { const n = { ...p }; delete n[task.id]; return n })}>Cancel</button></>
                          ) : (
                            <>
                              {cat.key === 'project' && <button className="small-button" onClick={() => setNoteModal({ taskId: task.id, text: '' })}>Add note</button>}
                              <button className="small-button" onClick={() => startEdit(task)}>Edit</button>
                            </>
                          )}
                        </div>
                      </div>
                      {cat.key === 'project' && (
                        <div className="project-notes">
                          <div className="notes-list">
                            {(task.projectNotes ?? []).map((n) => (
                              <div key={n.id} className="note-row">
                                <label className="checkbox" onClick={(e) => { e.preventDefault(); if (e.detail >= 2) deleteNote(task.id, n.id) }}><input type="checkbox" /><span /></label>
                                <p>{n.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      {noteModal.taskId && (
        <div className="modal-backdrop">
          <div className="modal-card no-drag">
            <h4>Add note</h4>
            <textarea className="modal-textarea" rows={4} value={noteModal.text} onChange={(e) => setNoteModal(p => ({ ...p, text: e.target.value }))} placeholder="Note" />
            <div className="modal-actions">
              <button className="button" onClick={submitNoteModal}>Save</button>
              <button className="small-button" onClick={() => setNoteModal({ taskId: null, text: '' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TooDooOverlay
