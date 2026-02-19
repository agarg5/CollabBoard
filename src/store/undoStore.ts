import { create } from 'zustand'
import type { BoardObject } from '../types/board'

const MAX_HISTORY = 50

export type UndoActionType =
  | 'create'
  | 'delete'
  | 'update'

/** A single undoable action. Stores the object snapshot before and/or after. */
export interface UndoAction {
  type: UndoActionType
  /** For create: the created object. For delete: the deleted object. For update: the object id. */
  objectId: string
  /** Snapshot of the object BEFORE the action (null for create). */
  before: BoardObject | null
  /** Snapshot of the object AFTER the action (null for delete). */
  after: BoardObject | null
}

/** A group of actions that should be undone/redone together (e.g., multi-select move). */
export interface UndoEntry {
  actions: UndoAction[]
}

interface UndoState {
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  /** Push a new undoable entry. Clears the redo stack. */
  pushUndo: (entry: UndoEntry) => void
  /** Pop the last undo entry and move it to the redo stack. Returns the entry or null. */
  popUndo: () => UndoEntry | null
  /** Pop the last redo entry and move it to the undo stack. Returns the entry or null. */
  popRedo: () => UndoEntry | null
  /** Clear all history (e.g., when switching boards). */
  clearHistory: () => void
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUndo: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack.slice(-(MAX_HISTORY - 1)), entry],
      redoStack: [],
    })),

  popUndo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return null
    const entry = undoStack[undoStack.length - 1]
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    }))
    return entry
  },

  popRedo: () => {
    const { redoStack } = get()
    if (redoStack.length === 0) return null
    const entry = redoStack[redoStack.length - 1]
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, entry],
    }))
    return entry
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),
}))
