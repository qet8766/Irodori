import { useEffect, useState, type FormEvent } from 'react'
import type { Todo } from '@shared/types'

const TooDooOverlay = () => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    window.irodori.todos
      .list()
      .then((data) => setTodos(data))
      .finally(() => setIsLoading(false))
  }, [])

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return

    const id = crypto.randomUUID()
    const optimistic: Todo = {
      id,
      content,
      isDone: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
    }

    setTodos((prev) => [...prev, optimistic])
    setDraft('')

    try {
      const saved = await window.irodori.todos.add({ id, content })
      setTodos((prev) => prev.map((item) => (item.id === id ? saved : item)))
    } catch (error) {
      console.error('Failed to persist todo', error)
    }
  }

  const toggleTodo = async (todo: Todo) => {
    try {
      const updated = await window.irodori.todos.toggle(todo.id, !todo.isDone)
      if (!updated) return
      setTodos((prev) => prev.map((item) => (item.id === todo.id ? updated : item)))
    } catch (error) {
      console.error('Failed to toggle todo', error)
    }
  }

  const removeTodo = async (id: string) => {
    try {
      await window.irodori.todos.remove(id)
      setTodos((prev) => prev.filter((item) => item.id !== id))
    } catch (error) {
      console.error('Failed to delete todo', error)
    }
  }

  return (
    <div className="overlay-shell">
      <div className="overlay-header">
        <div>
          <div className="overlay-title">TooDoo</div>
          <div className="muted">Always-on-top mini task desk</div>
        </div>
        <div className="pill">Overlay</div>
      </div>

      <form className="input-row" onSubmit={handleAdd}>
        <input
          className="no-drag"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Drop a quick todo…"
        />
        <button className="button no-drag" type="submit">
          Add
        </button>
      </form>

      <ul className="todo-list">
        {isLoading && <li className="muted">Syncing your todos…</li>}
        {!isLoading && todos.length === 0 && <li className="muted">No tasks yet. Add one to begin.</li>}
        {todos.map((todo) => (
          <li key={todo.id} className="todo-item no-drag">
            <input
              type="checkbox"
              checked={todo.isDone}
              onChange={() => toggleTodo(todo)}
              className="no-drag"
            />
            <p className={`todo-text ${todo.isDone ? 'done' : ''}`}>{todo.content}</p>
            <button className="small-button" onClick={() => removeTodo(todo.id)} type="button">
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TooDooOverlay
