import { create } from 'zustand'

type ToolStore = {
  activeTools: Record<string, boolean>
  toggleTool: (tool: string) => void
  setToolState: (tool: string, active: boolean) => void
}

const useToolStore = create<ToolStore>((set, get) => ({
  activeTools: { TooDoo: false },
  toggleTool: (tool: string) => {
    const nextState = !get().activeTools[tool]
    window.irodori.toggleTool(tool, nextState)
    set((state) => ({
      activeTools: { ...state.activeTools, [tool]: nextState },
    }))
  },
  setToolState: (tool: string, active: boolean) =>
    set((state) => ({
      activeTools: { ...state.activeTools, [tool]: active },
    })),
}))

export default useToolStore
