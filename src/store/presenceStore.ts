import { create } from 'zustand'
import type { CursorPosition, PresenceUser } from '../types/board'

interface PresenceState {
  cursors: Record<string, CursorPosition>
  onlineUsers: PresenceUser[]
  setCursor: (userId: string, cursor: CursorPosition) => void
  removeCursor: (userId: string) => void
  setOnlineUsers: (users: PresenceUser[]) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  cursors: {},
  onlineUsers: [],
  setCursor: (userId, cursor) =>
    set((state) => ({ cursors: { ...state.cursors, [userId]: cursor } })),
  removeCursor: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.cursors
      return { cursors: rest }
    }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
}))

// Expose store for E2E tests when running in dev bypass mode
if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
  ;(window as unknown as Record<string, unknown>).__presenceStore = usePresenceStore
}
