import { create } from 'zustand'

interface UiState {
  tool: 'select' | 'hand' | 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'text' | 'connector'
  stagePosition: { x: number; y: number }
  stageScale: number
  editingId: string | null
  chatPanelOpen: boolean
  setTool: (tool: UiState['tool']) => void
  setStagePosition: (pos: { x: number; y: number }) => void
  setStageScale: (scale: number) => void
  setEditingId: (id: string | null) => void
  setChatPanelOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  tool: 'select',
  stagePosition: { x: 0, y: 0 },
  stageScale: 1,
  editingId: null,
  chatPanelOpen: false,
  setTool: (tool) => set({ tool }),
  setStagePosition: (stagePosition) => set({ stagePosition }),
  setStageScale: (stageScale) => set({ stageScale }),
  setEditingId: (editingId) => set({ editingId }),
  setChatPanelOpen: (chatPanelOpen) => set({ chatPanelOpen }),
}))
