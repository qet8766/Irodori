import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectNote, Task, TaskCategory } from '@shared/types'

const categories: { key: TaskCategory; title: string; tone: 'cyan' | 'amber' | 'violet' }[] = [
  { key: 'short_term', title: 'Short-term', tone: 'cyan' },
  { key: 'long_term', title: 'Long-term', tone: 'amber' },
  { key: 'project', title: 'Projects', tone: 'violet' },
]

const TooDooOverlay = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Record<string, { title: string; description: string }>>({})
  const [deleteArm, setDeleteArm] = useState<Record<string, number>>({})
  const deleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [isLoading, setIsLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await window.irodori.tasks.list()
      setTasks(data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    window.irodori.onTasksChanged(fetchTasks)
  }, [fetchTasks])

  const tasksByCategory = useMemo(
    () =>
      categories.reduce<Record<TaskCategory, Task[]>>((acc, item) => {
        acc[item.key] = tasks.filter((task) => task.category === item.key)
        return acc
      }, { short_term: [], long_term: [], project: [] }),
    [tasks],
  )

  const startEdit = (task: Task) => {
    setEditing((prev) => ({ ...prev, [task.id]: { title: task.title, description: task.description ?? '' } }))
  }

  const cancelEdit = (taskId: string) => {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }

  const saveEdit = async (taskId: string) => {
    const form = editing[taskId]
    if (!form) return
    try {
      const updated = await window.irodori.tasks.update({
        id: taskId,
        title: form.title,
        description: form.description.trim() ? form.description : null,
      })
      if (updated) {
        setTasks((prev) => prev.map((item) => (item.id === taskId ? updated : item)))
      }
    } catch (error) {
      console.error('Failed to save edits', error)
    } finally {
      cancelEdit(taskId)
    }
  }

  const removeTask = async (taskId: string) => {
    try {
      await window.irodori.tasks.remove(taskId)
      setTasks((prev) => prev.filter((item) => item.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task', error)
    }
  }

  const addNote = async (taskId: string) => {
    const content = (noteDrafts[taskId] ?? '').trim()
    if (!content) return

    const optimistic: ProjectNote = {
      id: crypto.randomUUID(),
      taskId,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, projectNotes: [...(task.projectNotes ?? []), optimistic] }
          : task,
      ),
    )
    setNoteDrafts((prev) => ({ ...prev, [taskId]: '' }))

    try {
      const saved = await window.irodori.tasks.addNote(optimistic)
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                projectNotes: (task.projectNotes ?? []).map((note) => (note.id === optimistic.id ? saved : note)),
              }
            : task,
        ),
      )
    } catch (error) {
      console.error('Failed to add project note', error)
    }
  }

  const deleteNote = async (taskId: string, noteId: string) => {
    try {
      await window.irodori.tasks.removeNote(noteId)
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, projectNotes: (task.projectNotes ?? []).filter((note) => note.id !== noteId) }
            : task,
        ),
      )
    } catch (error) {
      console.error('Failed to delete note', error)
    }
  }

  const clearDeleteArm = (taskId: string) => {
    if (deleteTimers.current[taskId]) {
      clearTimeout(deleteTimers.current[taskId])
      delete deleteTimers.current[taskId]
    }
    setDeleteArm((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }

  const handleDeleteClick = (taskId: string) => {
    const now = Date.now()
    const lastClick = deleteArm[taskId]
    if (lastClick && now - lastClick <= 500) {
      clearDeleteArm(taskId)
      void removeTask(taskId)
      return
    }

    if (deleteTimers.current[taskId]) clearTimeout(deleteTimers.current[taskId])
    setDeleteArm((prev) => ({ ...prev, [taskId]: now }))
    deleteTimers.current[taskId] = setTimeout(() => clearDeleteArm(taskId), 500)
  }

  useEffect(
    () => () => {
      Object.values(deleteTimers.current).forEach((timer) => clearTimeout(timer))
    },
    [],
  )

  return (
    <div className="overlay-shell">
      <div className="drag-bar" />
      <div className="overlay-header">
        <div className="overlay-title">TooDoo</div>
        <div className="pill-row">
          <div className="pill no-drag">Always on top</div>
        </div>
      </div>

      <div className="task-columns">
        {categories.map((category) => (
          <section key={category.key} className={`task-section tone-${category.tone}`}>
            <div className="section-header simple">
              <div className="section-title">
                <span className="section-dot" />
                <h3>{category.title}</h3>
              </div>
              <div className="count-pill">{tasksByCategory[category.key].length}</div>
            </div>

            {isLoading && <p className="muted">Loading tasks…</p>}
            {!isLoading && tasksByCategory[category.key].length === 0 && (
              <p className="muted">No items yet.</p>
            )}

            <div className="task-list">
              {tasksByCategory[category.key].map((task) => {
                const formState = editing[task.id]
                const isEditing = Boolean(formState)
                const isArmed = Boolean(deleteArm[task.id])
                return (
                  <div
                    key={task.id}
                    className={`task-card no-drag ${category.key === 'project' ? 'project-card' : ''} ${isArmed ? 'armed' : ''}`}
                  >
                    <div className="task-card-header">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={isArmed}
                          onChange={() => handleDeleteClick(task.id)}
                          aria-label="Delete task"
                        />
                        <span />
                      </label>
                      {isEditing ? (
                        <div className="task-editing">
                          <input
                            className="edit-input"
                            value={formState?.title ?? ''}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [task.id]: { ...formState!, title: e.target.value },
                              }))
                            }
                          />
                          <textarea
                            className="edit-textarea"
                            rows={3}
                            value={formState?.description ?? ''}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [task.id]: { ...formState!, description: e.target.value },
                              }))
                            }
                            placeholder="Description"
                          />
                        </div>
                      ) : (
                        <div className="task-text">
                          <div className="task-title">{task.title}</div>
                          {task.description ? <div className="muted small-text">{task.description}</div> : null}
                        </div>
                      )}

                      <div className="task-actions">
                        {isEditing ? (
                          <>
                            <button className="small-button" onClick={() => saveEdit(task.id)} type="button">
                              Save
                            </button>
                            <button className="small-button" onClick={() => cancelEdit(task.id)} type="button">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="small-button" onClick={() => startEdit(task)} type="button">
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {category.key === 'project' && (
                      <div className="project-notes">
                        <div className="notes-list">
                          {(task.projectNotes ?? []).map((note) => (
                            <div key={note.id} className="note-row">
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  onChange={() => deleteNote(task.id, note.id)}
                                  aria-label="Delete note"
                                />
                                <span />
                              </label>
                              <p>{note.content}</p>
                            </div>
                          ))}
                          {task.projectNotes?.length === 0 && <p className="muted">No notes yet.</p>}
                        </div>
                        <div className="note-input">
                          <input
                            placeholder="Add note"
                            value={noteDrafts[task.id] ?? ''}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          />
                          <button className="button" type="button" onClick={() => addNote(task.id)}>
                            Add note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default TooDooOverlay
