import { create } from 'zustand'

interface UiState {
  tool: 'select' | 'sticky_note' | 'rectangle' | 'circle' | 'text' | 'connector'
  stagePosition: { x: number; y: number }
  stageScale: number
  setTool: (tool: UiState['tool']) => void
  setStagePosition: (pos: { x: number; y: number }) => void
  setStageScale: (scale: number) => void
}

export const useUiStore = create<UiState>((set) => ({
  tool: 'select',
  stagePosition: { x: 0, y: 0 },
  stageScale: 1,
  setTool: (tool) => set({ tool }),
  setStagePosition: (stagePosition) => set({ stagePosition }),
  setStageScale: (stageScale) => set({ stageScale }),
}))
