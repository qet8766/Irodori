import { useCallback, useEffect, useState } from 'react'
import type { AiruPrompt, AiruSettings, AiruProvider, AiruResult } from '@shared/types'

export const useAiruPrompts = () => {
  const [prompts, setPrompts] = useState<AiruPrompt[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await window.irodori.airu.prompts.list()
      setPrompts(data)
    } catch (error) {
      console.error('Failed to fetch prompts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrompts()
    window.irodori.airu.onPromptsChanged(fetchPrompts)
  }, [fetchPrompts])

  const addPrompt = useCallback(async (payload: { title: string; content: string }) => {
    const prompt = await window.irodori.airu.prompts.add({
      id: crypto.randomUUID(),
      ...payload,
    })
    return prompt
  }, [])

  const updatePrompt = useCallback(
    async (payload: { id: string; title?: string; content?: string; sortOrder?: number }) => {
      const updated = await window.irodori.airu.prompts.update(payload)
      if (updated) {
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      }
      return updated
    },
    [],
  )

  const deletePrompt = useCallback(async (id: string) => {
    await window.irodori.airu.prompts.remove(id)
    setPrompts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const reorderPrompts = useCallback(async (orderedIds: string[]) => {
    await window.irodori.airu.prompts.reorder(orderedIds)
    await fetchPrompts()
  }, [fetchPrompts])

  return {
    prompts,
    isLoading,
    refetch: fetchPrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    reorderPrompts,
  }
}

export const useAiruSettings = () => {
  const [settings, setSettings] = useState<AiruSettings | null>(null)

  useEffect(() => {
    window.irodori.airu.settings.get().then(setSettings)
  }, [])

  const updateSettings = useCallback(async (updates: Partial<AiruSettings>) => {
    await window.irodori.airu.settings.set(updates)
    setSettings((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  return { settings, updateSettings }
}

export const useAiruExecute = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<AiruResult | null>(null)

  const execute = useCallback(async (provider: AiruProvider, promptId: string, userInput: string) => {
    setIsLoading(true)
    try {
      const res = await window.irodori.airu.execute(provider, promptId, userInput)
      setResult(res)
      return res
    } catch (err) {
      const errorResult: AiruResult = {
        provider,
        promptTitle: 'Unknown',
        promptContent: '',
        userInput,
        fullRequest: '',
        response: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      }
      setResult(errorResult)
      return errorResult
    } finally {
      setIsLoading(false)
    }
  }, [])

  const paste = useCallback((text: string) => {
    window.irodori.airu.paste(text)
  }, [])

  const close = useCallback(() => {
    window.irodori.airu.close()
  }, [])

  return { execute, paste, close, isLoading, result }
}
