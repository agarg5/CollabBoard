import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBoardStore } from '../store/boardStore'
import { executeToolCall } from './aiExecutor'
import type { AIToolCall, BoardObject } from '../types/board'

vi.mock('./boardSync', () => ({
  insertObject: vi.fn().mockResolvedValue(undefined),
  patchObject: vi.fn().mockResolvedValue(undefined),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}))

const ctx = { boardId: 'board-1', userId: 'user-1' }

function makeToolCall(name: string, args: Record<string, unknown>): AIToolCall {
  return {
    id: `call_${name}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  }
}

const makeObject = (overrides: Partial<BoardObject> = {}): BoardObject => ({
  id: 'existing-1',
  board_id: 'board-1',
  type: 'sticky_note',
  properties: { text: 'Hello', color: '#fef08a' },
  x: 100,
  y: 200,
  width: 200,
  height: 200,
  z_index: 1,
  created_by: 'user-1',
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe('aiExecutor', () => {
  beforeEach(() => {
    useBoardStore.setState({ boardId: 'board-1', objects: [], selectedIds: [] })
  })

  describe('createStickyNote', () => {
    it('creates a sticky note with defaults', async () => {
      const tc = makeToolCall('createStickyNote', { text: 'Test', x: 100, y: 200 })
      const result = await executeToolCall(tc, ctx)

      expect(result.id).toBe('call_createStickyNote')
      const objects = useBoardStore.getState().objects
      expect(objects).toHaveLength(1)
      expect(objects[0].type).toBe('sticky_note')
      expect(objects[0].x).toBe(100)
      expect(objects[0].y).toBe(200)
      expect(objects[0].width).toBe(200)
      expect(objects[0].height).toBe(200)
      expect(objects[0].properties).toEqual({ text: 'Test', color: '#fef08a' })
      expect(objects[0].board_id).toBe('board-1')
      expect(objects[0].created_by).toBe('user-1')
    })

    it('uses custom color and size when provided', async () => {
      const tc = makeToolCall('createStickyNote', {
        text: 'Custom',
        x: 50,
        y: 60,
        color: '#fda4af',
        width: 300,
        height: 250,
      })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.width).toBe(300)
      expect(obj.height).toBe(250)
      expect(obj.properties.color).toBe('#fda4af')
    })
  })

  describe('createShape', () => {
    it('creates a rectangle with defaults', async () => {
      const tc = makeToolCall('createShape', { shapeType: 'rectangle', x: 10, y: 20 })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.type).toBe('rectangle')
      expect(obj.width).toBe(150)
      expect(obj.height).toBe(100)
      expect(obj.properties.fillColor).toBe('#3b82f6')
      expect(obj.properties.strokeColor).toBe('#1e293b')
    })

    it('creates a circle with custom colors', async () => {
      const tc = makeToolCall('createShape', {
        shapeType: 'circle',
        x: 30,
        y: 40,
        fillColor: '#ff0000',
        strokeColor: '#00ff00',
      })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.type).toBe('circle')
      expect(obj.properties.fillColor).toBe('#ff0000')
    })
  })

  describe('createFrame', () => {
    it('creates a frame with defaults', async () => {
      const tc = makeToolCall('createFrame', { x: 0, y: 0 })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.type).toBe('frame')
      expect(obj.width).toBe(400)
      expect(obj.height).toBe(300)
      expect(obj.properties.label).toBe('')
    })

    it('uses provided label and size', async () => {
      const tc = makeToolCall('createFrame', { x: 0, y: 0, label: 'My Frame', width: 600, height: 500 })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.properties.label).toBe('My Frame')
      expect(obj.width).toBe(600)
    })
  })

  describe('createConnector', () => {
    it('creates a connector between two points', async () => {
      const tc = makeToolCall('createConnector', { fromX: 10, fromY: 20, toX: 110, toY: 120 })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.type).toBe('connector')
      expect(obj.properties.fromX).toBe(10)
      expect(obj.properties.toY).toBe(120)
      expect(obj.properties.color).toBe('#1e293b')
    })
  })

  describe('moveObject', () => {
    it('updates position of an existing object', async () => {
      useBoardStore.getState().addObject(makeObject())
      const tc = makeToolCall('moveObject', { objectId: 'existing-1', x: 500, y: 600 })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.x).toBe(500)
      expect(obj.y).toBe(600)
    })
  })

  describe('resizeObject', () => {
    it('updates dimensions of an existing object', async () => {
      useBoardStore.getState().addObject(makeObject())
      const tc = makeToolCall('resizeObject', { objectId: 'existing-1', width: 400, height: 300 })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.width).toBe(400)
      expect(obj.height).toBe(300)
    })
  })

  describe('updateText', () => {
    it('updates text property of a sticky note', async () => {
      useBoardStore.getState().addObject(makeObject())
      const tc = makeToolCall('updateText', { objectId: 'existing-1', text: 'Updated text' })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.properties.text).toBe('Updated text')
      expect(obj.properties.color).toBe('#fef08a') // preserved
    })

    it('returns error for missing object', async () => {
      const tc = makeToolCall('updateText', { objectId: 'nonexistent', text: 'Nope' })
      const result = await executeToolCall(tc, ctx)
      expect((result.result as { error: string }).error).toBe('Object not found')
    })
  })

  describe('changeColor', () => {
    it('updates color property of an object', async () => {
      useBoardStore.getState().addObject(makeObject())
      const tc = makeToolCall('changeColor', { objectId: 'existing-1', color: '#ff0000' })
      await executeToolCall(tc, ctx)

      const obj = useBoardStore.getState().objects[0]
      expect(obj.properties.color).toBe('#ff0000')
      expect(obj.properties.text).toBe('Hello') // preserved
    })
  })

  describe('deleteObject', () => {
    it('removes an object from the store', async () => {
      useBoardStore.getState().addObject(makeObject())
      expect(useBoardStore.getState().objects).toHaveLength(1)

      const tc = makeToolCall('deleteObject', { objectId: 'existing-1' })
      await executeToolCall(tc, ctx)

      expect(useBoardStore.getState().objects).toHaveLength(0)
    })
  })

  describe('getBoardState', () => {
    it('returns current objects', async () => {
      useBoardStore.getState().addObject(makeObject({ id: 'a' }))
      useBoardStore.getState().addObject(makeObject({ id: 'b' }))

      const tc = makeToolCall('getBoardState', {})
      const result = await executeToolCall(tc, ctx)

      expect(result.result).toHaveLength(2)
    })
  })

  describe('z_index ordering', () => {
    it('assigns incrementing z_index to created objects', async () => {
      useBoardStore.getState().addObject(makeObject({ z_index: 5 }))

      await executeToolCall(makeToolCall('createStickyNote', { text: 'A', x: 0, y: 0 }), ctx)
      await executeToolCall(makeToolCall('createStickyNote', { text: 'B', x: 0, y: 0 }), ctx)

      const objects = useBoardStore.getState().objects
      expect(objects[1].z_index).toBe(6)
      expect(objects[2].z_index).toBe(7)
    })
  })

  describe('unknown tool', () => {
    it('returns error for unrecognized tool name', async () => {
      const tc = makeToolCall('nonExistentTool', {})
      const result = await executeToolCall(tc, ctx)
      expect((result.result as { error: string }).error).toBe('Unknown tool: nonExistentTool')
    })
  })
})
