import { useCallback, useEffect, useState } from 'react'

type SyncStatus = {
  isOnline: boolean
  pendingCount: number
  lastSyncAt: number
}

export const useSyncStatus = (pollInterval = 5000) => {
  const [status, setStatus] = useState<SyncStatus | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await window.irodori.settings.getSyncStatus()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch sync status:', error)
    }
  }, [])

  useEffect(() => {
    fetchStatus()

    const interval = setInterval(fetchStatus, pollInterval)
    return () => clearInterval(interval)
  }, [fetchStatus, pollInterval])

  const triggerSync = useCallback(async () => {
    await window.irodori.settings.triggerSync()
    await fetchStatus()
  }, [fetchStatus])

  return { status, triggerSync, refetch: fetchStatus }
}

export const useApiUrl = () => {
  const [apiUrl, setApiUrl] = useState('')

  useEffect(() => {
    window.irodori.settings.getApiUrl().then(setApiUrl)
  }, [])

  const updateApiUrl = useCallback(async (url: string) => {
    await window.irodori.settings.setApiUrl(url)
    setApiUrl(url)
  }, [])

  return { apiUrl, setApiUrl: updateApiUrl }
}
