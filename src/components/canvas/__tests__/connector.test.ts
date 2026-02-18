import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../../../store/boardStore'
import type { BoardObject } from '../../../types/board'

function createConnector(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: 'board-1',
    type: 'connector',
    properties: { strokeColor: '#1e293b', strokeWidth: 2 },
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    z_index: 0,
    rotation: 0,
    created_by: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function createRect(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: 'board-1',
    type: 'rectangle',
    properties: { fillColor: '#3b82f6', strokeColor: '#1e293b', strokeWidth: 2 },
    x: 0,
    y: 0,
    width: 150,
    height: 100,
    z_index: 0,
    rotation: 0,
    created_by: '',
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('connector creation', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('creates a connector with default properties', () => {
    const conn = createConnector()
    expect(conn.type).toBe('connector')
    expect(conn.properties.strokeColor).toBe('#1e293b')
    expect(conn.properties.strokeWidth).toBe(2)
  })

  it('adds a connector to the board store', () => {
    const conn = createConnector()
    useBoardStore.getState().addObject(conn)
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].type).toBe('connector')
  })

  it('creates a connector with attached object IDs', () => {
    const rectA = createRect({ x: 0, y: 0 })
    const rectB = createRect({ x: 300, y: 200 })
    const conn = createConnector({
      properties: {
        strokeColor: '#1e293b',
        strokeWidth: 2,
        startObjectId: rectA.id,
        endObjectId: rectB.id,
      },
      x: rectA.x + rectA.width / 2,
      y: rectA.y + rectA.height / 2,
      width: (rectB.x + rectB.width / 2) - (rectA.x + rectA.width / 2),
      height: (rectB.y + rectB.height / 2) - (rectA.y + rectA.height / 2),
    })

    useBoardStore.getState().addObject(rectA)
    useBoardStore.getState().addObject(rectB)
    useBoardStore.getState().addObject(conn)

    const stored = useBoardStore.getState().objects.find((o) => o.type === 'connector')!
    expect(stored.properties.startObjectId).toBe(rectA.id)
    expect(stored.properties.endObjectId).toBe(rectB.id)
  })
})

describe('connector endpoint update', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('updates connector position when a connected object moves', () => {
    const rectA = createRect({ x: 0, y: 0, width: 100, height: 100 })
    const rectB = createRect({ x: 300, y: 200, width: 100, height: 100 })

    // Connector from center of A to center of B
    const conn = createConnector({
      properties: {
        strokeColor: '#1e293b',
        strokeWidth: 2,
        startObjectId: rectA.id,
        endObjectId: rectB.id,
      },
      x: 50,   // center of A
      y: 50,
      width: 300, // delta to center of B (350-50)
      height: 200, // delta (250-50)
    })

    useBoardStore.getState().addObject(rectA)
    useBoardStore.getState().addObject(rectB)
    useBoardStore.getState().addObject(conn)

    // Simulate moving rectA to (100, 100)
    useBoardStore.getState().updateObject(rectA.id, { x: 100, y: 100 })

    // Manually trigger endpoint update logic (mirrors ObjectLayer.updateConnectorEndpoints)
    const objects = useBoardStore.getState().objects
    const movedObj = objects.find((o) => o.id === rectA.id)!
    const newStartX = movedObj.x + movedObj.width / 2  // 150
    const newStartY = movedObj.y + movedObj.height / 2  // 150
    const endObj = objects.find((o) => o.id === rectB.id)!
    const endX = endObj.x + endObj.width / 2  // 350
    const endY = endObj.y + endObj.height / 2  // 250

    useBoardStore.getState().updateObject(conn.id, {
      x: newStartX,
      y: newStartY,
      width: endX - newStartX,
      height: endY - newStartY,
    })

    const updatedConn = useBoardStore.getState().objects.find((o) => o.id === conn.id)!
    expect(updatedConn.x).toBe(150)
    expect(updatedConn.y).toBe(150)
    expect(updatedConn.width).toBe(200)
    expect(updatedConn.height).toBe(100)
  })
})

describe('connector color update', () => {
  beforeEach(() => {
    useBoardStore.setState({ objects: [], selectedIds: [] })
  })

  it('updates strokeColor via updateObject', () => {
    const conn = createConnector()
    useBoardStore.getState().addObject(conn)

    useBoardStore.getState().updateObject(conn.id, {
      properties: { ...conn.properties, strokeColor: '#ef4444' },
    })

    const updated = useBoardStore.getState().objects[0]
    expect(updated.properties.strokeColor).toBe('#ef4444')
  })
})
