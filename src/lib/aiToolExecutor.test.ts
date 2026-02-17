import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
}))

const mockInsert = vi.fn().mockResolvedValue(undefined)
const mockPatch = vi.fn().mockResolvedValue(undefined)
const mockDelete = vi.fn().mockResolvedValue(undefined)
vi.mock('./boardSync', () => ({
  insertObject: (...args: unknown[]) => mockInsert(...args),
  patchObject: (...args: unknown[]) => mockPatch(...args),
  deleteObject: (...args: unknown[]) => mockDelete(...args),
}))

import { executeToolCalls } from './aiToolExecutor'
import { useBoardStore } from '../store/boardStore'
import type { BoardObject } from '../types/board'

const makeObject = (overrides: Partial<BoardObject> = {}): BoardObject => ({
  id: 'obj-1',
  board_id: 'board-1',
  type: 'sticky_note',
  properties: { text: 'Hello', color: '#fef08a' },
  x: 100,
  y: 200,
  width: 200,
  height: 200,
  z_index: 1,
  created_by: null,
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('aiToolExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useBoardStore.setState({ boardId: 'board-1', objects: [], selectedIds: [] })
  })

  it('createStickyNote adds object to store and inserts to DB', async () => {
    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'createStickyNote',
            arguments: JSON.stringify({ text: 'Test', x: 100, y: 200 }),
          },
        },
      ],
      'board-1',
    )

    const objects = useBoardStore.getState().objects
    expect(objects).toHaveLength(1)
    expect(objects[0].type).toBe('sticky_note')
    expect(objects[0].properties.text).toBe('Test')
    expect(objects[0].properties.color).toBe('#fef08a')
    expect(objects[0].x).toBe(100)
    expect(objects[0].y).toBe(200)
    expect(mockInsert).toHaveBeenCalledOnce()
  })

  it('createStickyNote uses custom color and size', async () => {
    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'createStickyNote',
            arguments: JSON.stringify({
              text: 'Pink',
              x: 0,
              y: 0,
              color: '#fda4af',
              width: 300,
              height: 250,
            }),
          },
        },
      ],
      'board-1',
    )

    const obj = useBoardStore.getState().objects[0]
    expect(obj.properties.color).toBe('#fda4af')
    expect(obj.width).toBe(300)
    expect(obj.height).toBe(250)
  })

  it('createShape creates rectangle with correct properties', async () => {
    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'createShape',
            arguments: JSON.stringify({
              shapeType: 'rectangle',
              x: 50,
              y: 50,
              fillColor: '#ff0000',
            }),
          },
        },
      ],
      'board-1',
    )

    const obj = useBoardStore.getState().objects[0]
    expect(obj.type).toBe('rectangle')
    expect(obj.properties.fillColor).toBe('#ff0000')
    expect(obj.width).toBe(150)
    expect(obj.height).toBe(100)
  })

  it('moveObject updates position in store and DB', async () => {
    const existing = makeObject({ id: 'move-me' })
    useBoardStore.getState().addObject(existing)

    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'moveObject',
            arguments: JSON.stringify({ objectId: 'move-me', x: 500, y: 600 }),
          },
        },
      ],
      'board-1',
    )

    const obj = useBoardStore.getState().objects[0]
    expect(obj.x).toBe(500)
    expect(obj.y).toBe(600)
    expect(mockPatch).toHaveBeenCalledWith('move-me', expect.objectContaining({ x: 500, y: 600 }))
  })

  it('resizeObject updates dimensions', async () => {
    const existing = makeObject({ id: 'resize-me' })
    useBoardStore.getState().addObject(existing)

    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'resizeObject',
            arguments: JSON.stringify({ objectId: 'resize-me', width: 400, height: 300 }),
          },
        },
      ],
      'board-1',
    )

    const obj = useBoardStore.getState().objects[0]
    expect(obj.width).toBe(400)
    expect(obj.height).toBe(300)
    expect(mockPatch).toHaveBeenCalledOnce()
  })

  it('updateText modifies text in properties', async () => {
    const existing = makeObject({ id: 'text-obj' })
    useBoardStore.getState().addObject(existing)

    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'updateText',
            arguments: JSON.stringify({ objectId: 'text-obj', text: 'Updated' }),
          },
        },
      ],
      'board-1',
    )

    const obj = useBoardStore.getState().objects[0]
    expect(obj.properties.text).toBe('Updated')
    expect(mockPatch).toHaveBeenCalledOnce()
  })

  it('changeColor updates color for sticky note', async () => {
    const existing = makeObject({ id: 'color-obj' })
    useBoardStore.getState().addObject(existing)

    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'changeColor',
            arguments: JSON.stringify({ objectId: 'color-obj', color: '#86efac' }),
          },
        },
      ],
      'board-1',
    )

    const obj = useBoardStore.getState().objects[0]
    expect(obj.properties.color).toBe('#86efac')
  })

  it('changeColor uses fillColor for shapes', async () => {
    const existing = makeObject({
      id: 'shape-obj',
      type: 'rectangle',
      properties: { fillColor: '#3b82f6', strokeColor: '#1e293b', strokeWidth: 2 },
    })
    useBoardStore.getState().addObject(existing)

    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'changeColor',
            arguments: JSON.stringify({ objectId: 'shape-obj', color: '#ff0000' }),
          },
        },
      ],
      'board-1',
    )

    const obj = useBoardStore.getState().objects[0]
    expect(obj.properties.fillColor).toBe('#ff0000')
  })

  it('deleteObject removes from store and DB', async () => {
    const existing = makeObject({ id: 'delete-me' })
    useBoardStore.getState().addObject(existing)

    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'deleteObject',
            arguments: JSON.stringify({ objectId: 'delete-me' }),
          },
        },
      ],
      'board-1',
    )

    expect(useBoardStore.getState().objects).toHaveLength(0)
    expect(mockDelete).toHaveBeenCalledWith('delete-me')
  })

  it('executes multiple tool calls sequentially', async () => {
    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'createStickyNote',
            arguments: JSON.stringify({ text: 'First', x: 100, y: 100 }),
          },
        },
        {
          id: 'call-2',
          function: {
            name: 'createStickyNote',
            arguments: JSON.stringify({ text: 'Second', x: 340, y: 100 }),
          },
        },
      ],
      'board-1',
    )

    const objects = useBoardStore.getState().objects
    expect(objects).toHaveLength(2)
    expect(objects[0].properties.text).toBe('First')
    expect(objects[1].properties.text).toBe('Second')
    expect(objects[1].z_index).toBeGreaterThan(objects[0].z_index)
    expect(mockInsert).toHaveBeenCalledTimes(2)
  })

  it('skips unknown tool calls gracefully', async () => {
    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'unknownTool',
            arguments: '{}',
          },
        },
      ],
      'board-1',
    )

    expect(useBoardStore.getState().objects).toHaveLength(0)
  })

  it('updateText is no-op for nonexistent object', async () => {
    await executeToolCalls(
      [
        {
          id: 'call-1',
          function: {
            name: 'updateText',
            arguments: JSON.stringify({ objectId: 'nonexistent', text: 'X' }),
          },
        },
      ],
      'board-1',
    )

    expect(mockPatch).not.toHaveBeenCalled()
  })
})
