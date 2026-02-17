import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../../../store/boardStore'
import type { BoardObject } from '../../../types/board'

function createRect(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: '',
    type: 'rectangle',
    properties: { fillColor: '#3b82f6', strokeColor: '#1e293b', strokeWidth: 2 },
    x: 0,
    y: 0,
    width: 150,
    height: 100,
    z_index: 0,
    created_by: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('rectangle creation', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('creates a rectangle with default properties', () => {
    const rect = createRect()
    expect(rect.type).toBe('rectangle')
    expect(rect.properties.fillColor).toBe('#3b82f6')
    expect(rect.properties.strokeColor).toBe('#1e293b')
    expect(rect.properties.strokeWidth).toBe(2)
    expect(rect.width).toBe(150)
    expect(rect.height).toBe(100)
  })

  it('adds a rectangle to the board store', () => {
    const rect = createRect()
    useBoardStore.getState().addObject(rect)
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].type).toBe('rectangle')
  })
})

describe('rectangle color update', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('updates fillColor via updateObject', () => {
    const rect = createRect()
    useBoardStore.getState().addObject(rect)

    useBoardStore.getState().updateObject(rect.id, {
      properties: { ...rect.properties, fillColor: '#ef4444' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.fillColor).toBe('#ef4444')
  })

  it('preserves strokeColor when changing fillColor', () => {
    const rect = createRect()
    useBoardStore.getState().addObject(rect)

    useBoardStore.getState().updateObject(rect.id, {
      properties: { ...rect.properties, fillColor: '#22c55e' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.strokeColor).toBe('#1e293b')
    expect(updated.properties.fillColor).toBe('#22c55e')
  })
})
