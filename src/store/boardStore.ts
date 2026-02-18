import { create } from 'zustand'
import type { BoardObject } from '../types/board'

const PASTE_OFFSET = 20

interface BoardState {
  boardId: string | null
  objects: BoardObject[]
  selectedIds: string[]
  clipboard: BoardObject[]
  pasteCount: number
  setBoardId: (id: string | null) => void
  addObject: (obj: BoardObject) => void
  updateObject: (id: string, changes: Partial<BoardObject>) => void
  removeObject: (id: string) => void
  setObjects: (objects: BoardObject[]) => void
  setSelectedIds: (ids: string[]) => void
  selectAll: () => void
  deleteSelectedObjects: () => string[]
  copySelected: () => void
  pasteClipboard: (userId: string | null) => BoardObject[]
  duplicateSelected: (userId: string | null) => BoardObject[]
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardId: null,
  setBoardId: (id) => set({ boardId: id, objects: [], selectedIds: [] }),
  objects: [],
  selectedIds: [],
  clipboard: [],
  pasteCount: 0,
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
  selectAll: () => set((s) => ({ selectedIds: s.objects.map((o) => o.id) })),
  deleteSelectedObjects: () => {
    const { selectedIds, objects } = get()
    set({
      objects: objects.filter((o) => !selectedIds.includes(o.id)),
      selectedIds: [],
    })
    return selectedIds
  },
  copySelected: () => {
    const { selectedIds, objects } = get()
    if (selectedIds.length === 0) return
    const copied = objects.filter((o) => selectedIds.includes(o.id))
    set({ clipboard: copied, pasteCount: 0 })
  },
  pasteClipboard: (userId) => {
    const { clipboard, pasteCount, objects, boardId } = get()
    if (clipboard.length === 0 || !boardId) return []

    const maxZ = objects.reduce((max, o) => Math.max(max, o.z_index), 0)
    const newCount = pasteCount + 1
    const offset = newCount * PASTE_OFFSET

    const newObjects = clipboard.map((obj, i) => ({
      ...obj,
      id: crypto.randomUUID(),
      board_id: boardId,
      x: obj.x + offset,
      y: obj.y + offset,
      z_index: maxZ + i + 1,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }))

    set({
      objects: [...objects, ...newObjects],
      selectedIds: newObjects.map((o) => o.id),
      pasteCount: newCount,
    })
    return newObjects
  },
  duplicateSelected: (userId) => {
    const { selectedIds, objects, boardId } = get()
    if (selectedIds.length === 0 || !boardId) return []

    const selected = objects.filter((o) => selectedIds.includes(o.id))
    const maxZ = objects.reduce((max, o) => Math.max(max, o.z_index), 0)

    const newObjects = selected.map((obj, i) => ({
      ...obj,
      id: crypto.randomUUID(),
      board_id: boardId,
      x: obj.x + PASTE_OFFSET,
      y: obj.y + PASTE_OFFSET,
      z_index: maxZ + i + 1,
      created_by: userId,
      updated_at: new Date().toISOString(),
    }))

    set({
      objects: [...objects, ...newObjects],
      selectedIds: newObjects.map((o) => o.id),
    })
    return newObjects
  },
}))

// Expose store on window for E2E test access (dev bypass only)
if (import.meta.env.VITE_DEV_BYPASS_AUTH === 'true') {
  ;(window as unknown as Record<string, unknown>).__boardStore = useBoardStore
}
