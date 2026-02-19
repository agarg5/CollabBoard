import { useCallback } from 'react'
import { useBoardStore } from '../store/boardStore'
import { useUndoStore } from '../store/undoStore'
import type { UndoEntry, UndoAction } from '../store/undoStore'
import type { BoardObject } from '../types/board'
import { insertObject, patchObject, deleteObject } from '../lib/boardSync'

/**
 * Provides undo/redo operations that update both the Zustand store and Supabase.
 *
 * Call `undo()` and `redo()` from keyboard shortcuts or UI buttons.
 * Call the `track*` helpers to record actions into the undo stack from
 * existing mutation call-sites.
 */
export function useUndoRedo() {
  const undo = useCallback(() => {
    const entry = useUndoStore.getState().popUndo()
    if (!entry) return

    const store = useBoardStore.getState()

    // Apply each action in reverse order
    for (let i = entry.actions.length - 1; i >= 0; i--) {
      const action = entry.actions[i]
      applyReverse(action, store)
    }
  }, [])

  const redo = useCallback(() => {
    const entry = useUndoStore.getState().popRedo()
    if (!entry) return

    const store = useBoardStore.getState()

    // Apply each action forward
    for (const action of entry.actions) {
      applyForward(action, store)
    }
  }, [])

  return { undo, redo }
}

/** Apply the reverse of an action (used by undo). */
function applyReverse(
  action: UndoAction,
  store: ReturnType<typeof useBoardStore.getState>,
) {
  const now = new Date().toISOString()

  if (action.type === 'create') {
    // Undo a create = delete the object
    store.removeObject(action.objectId)
    deleteObject(action.objectId)
    return
  }

  if (action.type === 'delete') {
    // Undo a delete = re-insert the object
    if (!action.before) return
    const restored = { ...action.before, updated_at: now }
    store.addObject(restored)
    insertObject(restored)
    return
  }

  if (action.type === 'update') {
    // Undo an update = restore the "before" snapshot
    if (!action.before) return
    const changes: Partial<BoardObject> = {
      x: action.before.x,
      y: action.before.y,
      width: action.before.width,
      height: action.before.height,
      rotation: action.before.rotation,
      z_index: action.before.z_index,
      properties: action.before.properties,
      updated_at: now,
    }
    store.updateObject(action.objectId, changes)
    patchObject(action.objectId, changes)
  }
}

/** Apply an action forward (used by redo). */
function applyForward(
  action: UndoAction,
  store: ReturnType<typeof useBoardStore.getState>,
) {
  const now = new Date().toISOString()

  if (action.type === 'create') {
    // Redo a create = re-insert the object
    if (!action.after) return
    const restored = { ...action.after, updated_at: now }
    store.addObject(restored)
    insertObject(restored)
    return
  }

  if (action.type === 'delete') {
    // Redo a delete = remove the object again
    store.removeObject(action.objectId)
    deleteObject(action.objectId)
    return
  }

  if (action.type === 'update') {
    // Redo an update = apply the "after" snapshot
    if (!action.after) return
    const changes: Partial<BoardObject> = {
      x: action.after.x,
      y: action.after.y,
      width: action.after.width,
      height: action.after.height,
      rotation: action.after.rotation,
      z_index: action.after.z_index,
      properties: action.after.properties,
      updated_at: now,
    }
    store.updateObject(action.objectId, changes)
    patchObject(action.objectId, changes)
  }
}

// ---- Tracking helpers (called from mutation sites) ----

/** Record a newly created object for undo. */
export function trackCreate(obj: BoardObject) {
  const entry: UndoEntry = {
    actions: [{ type: 'create', objectId: obj.id, before: null, after: { ...obj } }],
  }
  useUndoStore.getState().pushUndo(entry)
}

/** Record creation of multiple objects for undo (e.g., paste, duplicate). */
export function trackBatchCreate(objects: BoardObject[]) {
  if (objects.length === 0) return
  const actions: UndoAction[] = objects.map((obj) => ({
    type: 'create' as const,
    objectId: obj.id,
    before: null,
    after: { ...obj },
  }))
  useUndoStore.getState().pushUndo({ actions })
}

/** Record deletion of one or more objects for undo. */
export function trackDelete(objects: BoardObject[]) {
  if (objects.length === 0) return
  const actions: UndoAction[] = objects.map((obj) => ({
    type: 'delete' as const,
    objectId: obj.id,
    before: { ...obj },
    after: null,
  }))
  useUndoStore.getState().pushUndo({ actions })
}

/**
 * Record an update to an object for undo.
 * Call BEFORE applying the change so `before` captures the current state.
 * Pass the full new object as `after`.
 */
export function trackUpdate(before: BoardObject, after: BoardObject) {
  const entry: UndoEntry = {
    actions: [{ type: 'update', objectId: before.id, before: { ...before }, after: { ...after } }],
  }
  useUndoStore.getState().pushUndo(entry)
}

/**
 * Record a batch update (e.g., multi-select move) for undo.
 * Each pair is [before, after] for one object.
 */
export function trackBatchUpdate(pairs: Array<{ before: BoardObject; after: BoardObject }>) {
  if (pairs.length === 0) return
  const actions: UndoAction[] = pairs.map(({ before, after }) => ({
    type: 'update' as const,
    objectId: before.id,
    before: { ...before },
    after: { ...after },
  }))
  useUndoStore.getState().pushUndo({ actions })
}
