import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../../../store/boardStore'
import type { BoardObject } from '../../../types/board'

function createLine(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: '',
    type: 'line',
    properties: { strokeColor: '#3b82f6', strokeWidth: 2 },
    x: 0,
    y: 0,
    width: 150,
    height: 2,
    z_index: 0,
    created_by: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('line creation', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('creates a line with default properties', () => {
    const line = createLine()
    expect(line.type).toBe('line')
    expect(line.properties.strokeColor).toBe('#3b82f6')
    expect(line.properties.strokeWidth).toBe(2)
    expect(line.width).toBe(150)
    expect(line.height).toBe(2)
  })

  it('adds a line to the board store', () => {
    const line = createLine()
    useBoardStore.getState().addObject(line)
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].type).toBe('line')
  })
})

describe('line color update', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('updates strokeColor via updateObject', () => {
    const line = createLine()
    useBoardStore.getState().addObject(line)

    useBoardStore.getState().updateObject(line.id, {
      properties: { ...line.properties, strokeColor: '#ef4444' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.strokeColor).toBe('#ef4444')
  })

  it('preserves strokeWidth when changing strokeColor', () => {
    const line = createLine()
    useBoardStore.getState().addObject(line)

    useBoardStore.getState().updateObject(line.id, {
      properties: { ...line.properties, strokeColor: '#22c55e' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.strokeWidth).toBe(2)
    expect(updated.properties.strokeColor).toBe('#22c55e')
  })
})
