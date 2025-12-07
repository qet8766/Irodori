import { useCallback, useEffect, useState } from 'react'
import type { Note } from '@shared/types'

export const useNotes = () => {
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await window.irodori.notes.list()
      setNotes(data)
    } catch (error) {
      console.error('Failed to fetch notes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
    window.irodori.onNotesChanged(fetchNotes)
  }, [fetchNotes])

  const addNote = useCallback(async (payload: { title: string; content: string }) => {
    const note = await window.irodori.notes.add({
      id: crypto.randomUUID(),
      ...payload,
    })
    return note
  }, [])

  const updateNote = useCallback(async (payload: { id: string; title?: string; content?: string }) => {
    const updated = await window.irodori.notes.update(payload)
    if (updated) {
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    }
    return updated
  }, [])

  const deleteNote = useCallback(async (id: string) => {
    await window.irodori.notes.remove(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const openEditor = useCallback((noteId?: string) => {
    window.irodori.noteEditor.open(noteId)
  }, [])

  const closeEditor = useCallback(() => {
    window.irodori.noteEditor.close()
  }, [])

  return {
    notes,
    isLoading,
    refetch: fetchNotes,
    addNote,
    updateNote,
    deleteNote,
    openEditor,
    closeEditor,
  }
}

export const useFilteredNotes = (searchQuery: string) => {
  const { notes, ...rest } = useNotes()

  const filteredNotes = searchQuery.trim()
    ? notes.filter(
        (note) =>
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : notes

  return { filteredNotes, notes, ...rest }
}
