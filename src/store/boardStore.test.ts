import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from './boardStore'
import type { BoardObject } from '../types/board'

const makeObject = (overrides: Partial<BoardObject> = {}): BoardObject => ({
  id: 'obj-1',
  board_id: 'board-1',
  type: 'sticky_note',
  properties: { text: 'Hello', color: '#FFEB3B' },
  x: 100,
  y: 200,
  width: 200,
  height: 200,
  z_index: 1,
  created_by: 'user-1',
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('boardStore', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('adds an object', () => {
    const obj = makeObject()
    useBoardStore.getState().addObject(obj)
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].id).toBe('obj-1')
  })

  it('updates an object', () => {
    const obj = makeObject()
    useBoardStore.getState().addObject(obj)
    useBoardStore.getState().updateObject('obj-1', { x: 300, y: 400 })
    const updated = useBoardStore.getState().objects[0]
    expect(updated.x).toBe(300)
    expect(updated.y).toBe(400)
  })

  it('removes an object', () => {
    useBoardStore.getState().addObject(makeObject({ id: 'a' }))
    useBoardStore.getState().addObject(makeObject({ id: 'b' }))
    useBoardStore.getState().removeObject('a')
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].id).toBe('b')
  })

  it('clears selection when removing a selected object', () => {
    useBoardStore.getState().addObject(makeObject({ id: 'a' }))
    useBoardStore.getState().setSelectedIds(['a'])
    useBoardStore.getState().removeObject('a')
    expect(useBoardStore.getState().selectedIds).toHaveLength(0)
  })

  it('setBoardId clears objects and selectedIds', () => {
    useBoardStore.getState().addObject(makeObject({ id: 'a' }))
    useBoardStore.getState().setSelectedIds(['a'])
    useBoardStore.getState().setBoardId('new-board')

    expect(useBoardStore.getState().boardId).toBe('new-board')
    expect(useBoardStore.getState().objects).toHaveLength(0)
    expect(useBoardStore.getState().selectedIds).toHaveLength(0)
  })

  it('setBoardId with null clears board state', () => {
    useBoardStore.setState({ boardId: 'some-board' })
    useBoardStore.getState().addObject(makeObject({ id: 'a' }))
    useBoardStore.getState().setBoardId(null)

    expect(useBoardStore.getState().boardId).toBeNull()
    expect(useBoardStore.getState().objects).toHaveLength(0)
  })

  it('deleteSelectedObjects removes objects and clears selection', () => {
    useBoardStore.getState().addObject(makeObject({ id: 'a' }))
    useBoardStore.getState().addObject(makeObject({ id: 'b' }))
    useBoardStore.getState().addObject(makeObject({ id: 'c' }))
    useBoardStore.getState().setSelectedIds(['a', 'c'])

    const deleted = useBoardStore.getState().deleteSelectedObjects()

    expect(deleted).toEqual(['a', 'c'])
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].id).toBe('b')
    expect(useBoardStore.getState().selectedIds).toHaveLength(0)
  })

  describe('clipboard operations', () => {
    beforeEach(() => {
      useBoardStore.setState({
        boardId: 'board-1',
        objects: [],
        selectedIds: [],
        clipboard: [],
        pasteCount: 0,
      })
    })

    it('copySelected snapshots selected objects into clipboard', () => {
      const a = makeObject({ id: 'a', x: 10, y: 20 })
      const b = makeObject({ id: 'b', x: 50, y: 60 })
      useBoardStore.setState({ objects: [a, b], selectedIds: ['a'] })

      useBoardStore.getState().copySelected()

      expect(useBoardStore.getState().clipboard).toHaveLength(1)
      expect(useBoardStore.getState().clipboard[0].id).toBe('a')
      expect(useBoardStore.getState().pasteCount).toBe(0)
    })

    it('copySelected does nothing when no selection', () => {
      useBoardStore.setState({ objects: [makeObject()], selectedIds: [] })
      useBoardStore.getState().copySelected()
      expect(useBoardStore.getState().clipboard).toHaveLength(0)
    })

    it('pasteClipboard creates clones with offset and fresh ids', () => {
      const original = makeObject({ id: 'a', x: 100, y: 200, z_index: 5 })
      useBoardStore.setState({ objects: [original], clipboard: [original], pasteCount: 0 })

      const pasted = useBoardStore.getState().pasteClipboard('user-2')

      expect(pasted).toHaveLength(1)
      expect(pasted[0].id).not.toBe('a')
      expect(pasted[0].x).toBe(120) // 100 + 20
      expect(pasted[0].y).toBe(220) // 200 + 20
      expect(pasted[0].z_index).toBe(6) // 5 + 1
      expect(pasted[0].created_by).toBe('user-2')
      expect(useBoardStore.getState().objects).toHaveLength(2)
      expect(useBoardStore.getState().selectedIds).toEqual([pasted[0].id])
    })

    it('repeated pastes cascade offset', () => {
      const original = makeObject({ id: 'a', x: 100, y: 200, z_index: 1 })
      useBoardStore.setState({ objects: [original], clipboard: [original], pasteCount: 0 })

      const first = useBoardStore.getState().pasteClipboard(null)
      expect(first[0].x).toBe(120) // +20

      const second = useBoardStore.getState().pasteClipboard(null)
      expect(second[0].x).toBe(140) // +40
    })

    it('copySelected resets pasteCount', () => {
      const a = makeObject({ id: 'a' })
      useBoardStore.setState({ objects: [a], selectedIds: ['a'], pasteCount: 5 })

      useBoardStore.getState().copySelected()
      expect(useBoardStore.getState().pasteCount).toBe(0)
    })

    it('pasteClipboard returns empty when clipboard is empty', () => {
      useBoardStore.setState({ clipboard: [] })
      const result = useBoardStore.getState().pasteClipboard(null)
      expect(result).toHaveLength(0)
    })

    it('duplicateSelected clones selected objects with offset', () => {
      const a = makeObject({ id: 'a', x: 50, y: 80, z_index: 3 })
      const b = makeObject({ id: 'b', x: 200, y: 300, z_index: 4, type: 'rectangle' })
      useBoardStore.setState({ objects: [a, b], selectedIds: ['a', 'b'] })

      const duped = useBoardStore.getState().duplicateSelected('user-3')

      expect(duped).toHaveLength(2)
      expect(duped[0].id).not.toBe('a')
      expect(duped[1].id).not.toBe('b')
      expect(duped[0].x).toBe(70) // 50 + 20
      expect(duped[0].y).toBe(100) // 80 + 20
      expect(duped[1].x).toBe(220)
      expect(duped[1].y).toBe(320)
      expect(duped[0].z_index).toBe(5)
      expect(duped[1].z_index).toBe(6)
      expect(duped[0].created_by).toBe('user-3')
      expect(useBoardStore.getState().objects).toHaveLength(4)
      expect(useBoardStore.getState().selectedIds).toEqual(duped.map((o) => o.id))
    })

    it('duplicateSelected returns empty when nothing selected', () => {
      useBoardStore.setState({ objects: [makeObject()], selectedIds: [] })
      const result = useBoardStore.getState().duplicateSelected(null)
      expect(result).toHaveLength(0)
    })
  })
})
