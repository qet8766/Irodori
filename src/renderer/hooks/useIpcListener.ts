import { useEffect, useRef } from 'react'

type CleanupFn = () => void
type SetupFn = (callback: () => void) => CleanupFn | void

export const useIpcListener = (setup: SetupFn, deps: React.DependencyList = []) => {
  const cleanupRef = useRef<CleanupFn | void>(undefined)

  useEffect(() => {
    const callback = () => {
      // This will be triggered by IPC events
    }

    cleanupRef.current = setup(callback)

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export const useTasksListener = (callback: () => void) => {
  useEffect(() => {
    window.irodori.onTasksChanged(callback)
  }, [callback])
}

export const useNotesListener = (callback: () => void) => {
  useEffect(() => {
    window.irodori.onNotesChanged(callback)
  }, [callback])
}

export const useAiruPromptsListener = (callback: () => void) => {
  useEffect(() => {
    window.irodori.airu.onPromptsChanged(callback)
  }, [callback])
}
