import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../../../store/boardStore'
import type { BoardObject } from '../../../types/board'

function createCircle(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: '',
    type: 'circle',
    properties: { fillColor: '#ec4899', strokeColor: '#1e293b', strokeWidth: 2 },
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    z_index: 0,
    rotation: 0,
    created_by: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('circle creation', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('creates a circle with default properties', () => {
    const circle = createCircle()
    expect(circle.type).toBe('circle')
    expect(circle.properties.fillColor).toBe('#ec4899')
    expect(circle.properties.strokeColor).toBe('#1e293b')
    expect(circle.properties.strokeWidth).toBe(2)
    expect(circle.width).toBe(120)
    expect(circle.height).toBe(120)
  })

  it('adds a circle to the board store', () => {
    const circle = createCircle()
    useBoardStore.getState().addObject(circle)
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].type).toBe('circle')
  })
})

describe('circle color update', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('updates fillColor via updateObject', () => {
    const circle = createCircle()
    useBoardStore.getState().addObject(circle)

    useBoardStore.getState().updateObject(circle.id, {
      properties: { ...circle.properties, fillColor: '#a855f7' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.fillColor).toBe('#a855f7')
  })

  it('preserves strokeColor when changing fillColor', () => {
    const circle = createCircle()
    useBoardStore.getState().addObject(circle)

    useBoardStore.getState().updateObject(circle.id, {
      properties: { ...circle.properties, fillColor: '#6b7280' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.strokeColor).toBe('#1e293b')
    expect(updated.properties.fillColor).toBe('#6b7280')
  })
})
