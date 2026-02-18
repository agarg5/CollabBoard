import { create } from 'zustand'
import type { ChatMessage } from '../types/board'

interface AiState {
  panelOpen: boolean
  messages: ChatMessage[]
  loading: boolean
  togglePanel: () => void
  addMessage: (msg: ChatMessage) => void
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
}

export const useAiStore = create<AiState>((set) => ({
  panelOpen: false,
  messages: [],
  loading: false,
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, partial) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    })),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ loading }),
}))
