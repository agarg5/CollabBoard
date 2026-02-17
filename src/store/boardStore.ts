import { create } from 'zustand'
import type { BoardObject } from '../types/board'
import { DEFAULT_BOARD_ID } from '../lib/constants'

interface BoardState {
  boardId: string
  objects: BoardObject[]
  selectedIds: string[]
  addObject: (obj: BoardObject) => void
  updateObject: (id: string, changes: Partial<BoardObject>) => void
  removeObject: (id: string) => void
  setObjects: (objects: BoardObject[]) => void
  setSelectedIds: (ids: string[]) => void
  deleteSelectedObjects: () => string[]
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardId: DEFAULT_BOARD_ID,
  objects: [],
  selectedIds: [],
  addObject: (obj) => set((state) => ({ objects: [...state.objects, obj] })),
  updateObject: (id, changes) =>
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, ...changes } : o)),
    })),
  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),
  setObjects: (objects) => set({ objects }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  deleteSelectedObjects: () => {
    const { selectedIds, objects } = get()
    set({
      objects: objects.filter((o) => !selectedIds.includes(o.id)),
      selectedIds: [],
    })
    return selectedIds
  },
}))
