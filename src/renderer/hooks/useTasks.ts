import { useCallback, useEffect, useState } from 'react'
import type { Task, TaskCategory } from '@shared/types'

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await window.irodori.tasks.list()
      setTasks(data)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    window.irodori.onTasksChanged(fetchTasks)
  }, [fetchTasks])

  const addTask = useCallback(
    async (payload: { title: string; description?: string; category: TaskCategory }) => {
      const task = await window.irodori.tasks.add({
        id: crypto.randomUUID(),
        ...payload,
      })
      return task
    },
    [],
  )

  const updateTask = useCallback(
    async (payload: { id: string; title?: string; description?: string | null; isDone?: boolean; category?: TaskCategory }) => {
      const updated = await window.irodori.tasks.update(payload)
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      }
      return updated
    },
    [],
  )

  const deleteTask = useCallback(async (id: string) => {
    await window.irodori.tasks.remove(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addProjectNote = useCallback(async (taskId: string, content: string) => {
    const note = await window.irodori.tasks.addNote({
      id: crypto.randomUUID(),
      taskId,
      content,
    })
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, projectNotes: [...(t.projectNotes ?? []), note] } : t,
      ),
    )
    return note
  }, [])

  const deleteProjectNote = useCallback(async (taskId: string, noteId: string) => {
    await window.irodori.tasks.removeNote(noteId)
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, projectNotes: (t.projectNotes ?? []).filter((n) => n.id !== noteId) }
          : t,
      ),
    )
  }, [])

  return {
    tasks,
    isLoading,
    refetch: fetchTasks,
    addTask,
    updateTask,
    deleteTask,
    addProjectNote,
    deleteProjectNote,
  }
}

export const useTasksByCategory = () => {
  const { tasks, ...rest } = useTasks()

  const tasksByCategory = tasks.reduce(
    (buckets, task) => {
      buckets[task.category]?.push(task)
      return buckets
    },
    { short_term: [], long_term: [], project: [], immediate: [] } as Record<TaskCategory, Task[]>,
  )

  return { tasksByCategory, tasks, ...rest }
}
