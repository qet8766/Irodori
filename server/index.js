import express from 'express'
import cors from 'cors'
import {
  getTasks, addTask, updateTask, deleteTask,
  addProjectNote, deleteProjectNote,
  getNotes, addNote, updateNote, deleteNote,
  getAiruPrompts, addAiruPrompt, updateAiruPrompt, deleteAiruPrompt, reorderAiruPrompts
} from './db.js'

const app = express()
const PORT = process.env.PORT || 3456

app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// --- Tasks ---

app.get('/api/tasks', (req, res) => {
  try {
    const tasks = getTasks()
    res.json(tasks)
  } catch (error) {
    console.error('[API] GET /api/tasks error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/tasks', (req, res) => {
  try {
    const { id, title, description, category, isDone } = req.body
    if (!id || !title || !category) {
      return res.status(400).json({ error: 'Missing required fields: id, title, category' })
    }
    const task = addTask({ id, title, description, category, isDone })
    res.status(201).json(task)
  } catch (error) {
    console.error('[API] POST /api/tasks error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    const task = updateTask(id, updates)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json(task)
  } catch (error) {
    console.error('[API] PUT /api/tasks/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params
    const deleted = deleteTask(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json({ id })
  } catch (error) {
    console.error('[API] DELETE /api/tasks/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

// --- Project Notes ---

app.post('/api/tasks/:taskId/notes', (req, res) => {
  try {
    const { taskId } = req.params
    const { id, content } = req.body
    if (!id || !content) {
      return res.status(400).json({ error: 'Missing required fields: id, content' })
    }
    const note = addProjectNote({ id, taskId, content })
    res.status(201).json(note)
  } catch (error) {
    console.error('[API] POST /api/tasks/:taskId/notes error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/tasks/notes/:id', (req, res) => {
  try {
    const { id } = req.params
    const deleted = deleteProjectNote(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Project note not found' })
    }
    res.json({ id })
  } catch (error) {
    console.error('[API] DELETE /api/tasks/notes/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

// --- Notes (NoteTank) ---

app.get('/api/notes', (req, res) => {
  try {
    const notes = getNotes()
    res.json(notes)
  } catch (error) {
    console.error('[API] GET /api/notes error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/notes', (req, res) => {
  try {
    const { id, title, content } = req.body
    if (!id || !title) {
      return res.status(400).json({ error: 'Missing required fields: id, title' })
    }
    const note = addNote({ id, title, content: content || '' })
    res.status(201).json(note)
  } catch (error) {
    console.error('[API] POST /api/notes error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/notes/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    const note = updateNote(id, updates)
    if (!note) {
      return res.status(404).json({ error: 'Note not found' })
    }
    res.json(note)
  } catch (error) {
    console.error('[API] PUT /api/notes/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/notes/:id', (req, res) => {
  try {
    const { id } = req.params
    const deleted = deleteNote(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Note not found' })
    }
    res.json({ id })
  } catch (error) {
    console.error('[API] DELETE /api/notes/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

// --- Airu Prompts ---

app.get('/api/airu/prompts', (req, res) => {
  try {
    const prompts = getAiruPrompts()
    res.json(prompts)
  } catch (error) {
    console.error('[API] GET /api/airu/prompts error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/airu/prompts', (req, res) => {
  try {
    const { id, title, content } = req.body
    if (!id || !title) {
      return res.status(400).json({ error: 'Missing required fields: id, title' })
    }
    const prompt = addAiruPrompt({ id, title, content: content || '' })
    res.status(201).json(prompt)
  } catch (error) {
    console.error('[API] POST /api/airu/prompts error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/airu/prompts/:id', (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body
    const prompt = updateAiruPrompt(id, updates)
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' })
    }
    res.json(prompt)
  } catch (error) {
    console.error('[API] PUT /api/airu/prompts/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/airu/prompts/:id', (req, res) => {
  try {
    const { id } = req.params
    const deleted = deleteAiruPrompt(id)
    if (!deleted) {
      return res.status(404).json({ error: 'Prompt not found' })
    }
    res.json({ id })
  } catch (error) {
    console.error('[API] DELETE /api/airu/prompts/:id error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.put('/api/airu/prompts/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array' })
    }
    reorderAiruPrompts(orderedIds)
    res.json({ success: true })
  } catch (error) {
    console.error('[API] PUT /api/airu/prompts/reorder error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Irodori API running on http://0.0.0.0:${PORT}`)
})
