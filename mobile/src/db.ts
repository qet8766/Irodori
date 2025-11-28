import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Task, TaskCategory } from './types'

const TASKS_KEY = 'toodoo_tasks'

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

async function loadTasks(): Promise<Task[]> {
  try {
    const data = await AsyncStorage.getItem(TASKS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
}

export async function getTasks(): Promise<Task[]> {
  const tasks = await loadTasks()
  return tasks.filter(t => !t.isDeleted).sort((a, b) => b.createdAt - a.createdAt)
}

export async function addTask(title: string, category: TaskCategory, description?: string): Promise<Task | null> {
  try {
    const now = Date.now()
    const task: Task = {
      id: generateId(),
      title,
      description,
      category,
      isDone: false,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    }

    const tasks = await loadTasks()
    tasks.push(task)
    await saveTasks(tasks)
    return task
  } catch (error) {
    console.error('Failed to add task:', error)
    return null
  }
}

export async function deleteTask(id: string): Promise<boolean> {
  try {
    const tasks = await loadTasks()
    const index = tasks.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks[index].isDeleted = true
      tasks[index].updatedAt = Date.now()
      await saveTasks(tasks)
    }
    return true
  } catch (error) {
    console.error('Failed to delete task:', error)
    return false
  }
}

export async function toggleTaskDone(id: string, isDone: boolean): Promise<boolean> {
  try {
    const tasks = await loadTasks()
    const index = tasks.findIndex(t => t.id === id)
    if (index !== -1) {
      tasks[index].isDone = isDone
      tasks[index].updatedAt = Date.now()
      await saveTasks(tasks)
    }
    return true
  } catch (error) {
    console.error('Failed to toggle task:', error)
    return false
  }
}
