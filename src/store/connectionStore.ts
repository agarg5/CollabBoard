import { create } from 'zustand'

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

interface ConnectionState {
  status: ConnectionStatus
  setStatus: (status: ConnectionStatus) => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'connecting',
  setStatus: (status) => set({ status }),
}))

// Expose store for E2E tests when running in dev bypass mode
if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
  ;(window as unknown as Record<string, unknown>).__connectionStore = useConnectionStore
}
