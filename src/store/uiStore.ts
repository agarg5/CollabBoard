import { create } from 'zustand'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface UiState {
  tool: 'select' | 'hand' | 'sticky_note' | 'rectangle' | 'circle' | 'line' | 'text' | 'connector' | 'frame'
  stagePosition: { x: number; y: number }
  stageScale: number
  editingId: string | null
  chatPanelOpen: boolean
  chatMessages: ChatMessage[]
  setTool: (tool: UiState['tool']) => void
  setStagePosition: (pos: { x: number; y: number }) => void
  setStageScale: (scale: number) => void
  setEditingId: (id: string | null) => void
  setChatPanelOpen: (open: boolean) => void
  addChatMessage: (message: ChatMessage) => void
}

export const useUiStore = create<UiState>((set) => ({
  tool: 'select',
  stagePosition: { x: 0, y: 0 },
  stageScale: 1,
  editingId: null,
  chatPanelOpen: false,
  chatMessages: [],
  setTool: (tool) => set({ tool }),
  setStagePosition: (stagePosition) => set({ stagePosition }),
  setStageScale: (stageScale) => set({ stageScale }),
  setEditingId: (editingId) => set({ editingId }),
  setChatPanelOpen: (chatPanelOpen) => set({ chatPanelOpen }),
  addChatMessage: (message) => set((s) => ({ chatMessages: [...s.chatMessages, message] })),
}))

// Expose store for E2E tests when running in dev bypass mode
if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
  ;(window as unknown as Record<string, unknown>).__uiStore = useUiStore
}
