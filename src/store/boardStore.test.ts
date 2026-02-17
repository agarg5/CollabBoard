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
})
