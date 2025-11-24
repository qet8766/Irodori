import { create } from 'zustand'

type ToolStore = {
  activeTools: Record<string, boolean>
  toggleTool: (tool: string) => void
}

const useToolStore = create<ToolStore>((set, get) => ({
  activeTools: { TooDoo: false, Transly: false },
  toggleTool: (tool: string) => {
    const nextState = !get().activeTools[tool]
    window.irodori.toggleTool(tool, nextState)
    set((state) => ({
      activeTools: { ...state.activeTools, [tool]: nextState },
    }))
  },
}))

export default useToolStore
