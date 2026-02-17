import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBoardStore } from '../../store/boardStore'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { BoardObject } from '../../types/board'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

const { handleRealtimePayload } = await import('../useRealtimeSync')

const boardId = '00000000-0000-0000-0000-000000000001'

const makeObject = (overrides: Partial<BoardObject> = {}): BoardObject => ({
  id: 'obj-1',
  board_id: boardId,
  type: 'sticky_note',
  properties: { text: '', color: '#fef08a' },
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  z_index: 1,
  created_by: 'user-1',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

type Payload = RealtimePostgresChangesPayload<BoardObject>

const insertPayload = (obj: BoardObject): Payload =>
  ({ eventType: 'INSERT', new: obj, old: {} }) as Payload

const updatePayload = (obj: BoardObject): Payload =>
  ({ eventType: 'UPDATE', new: obj, old: {} }) as Payload

const deletePayload = (obj: BoardObject): Payload =>
  ({ eventType: 'DELETE', new: {}, old: obj }) as Payload

describe('handleRealtimePayload echo avoidance', () => {
  beforeEach(() => {
    useBoardStore.setState({ boardId, objects: [], selectedIds: [] })
  })

  it('INSERT: skips if object already exists in store', () => {
    useBoardStore.getState().addObject(makeObject({ id: 'obj-1' }))
    handleRealtimePayload(insertPayload(makeObject({ id: 'obj-1' })))
    expect(useBoardStore.getState().objects).toHaveLength(1)
  })

  it('INSERT: adds object if not in store', () => {
    handleRealtimePayload(insertPayload(makeObject({ id: 'new-obj' })))
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].id).toBe('new-obj')
  })

  it('UPDATE: skips if local updated_at >= incoming', () => {
    useBoardStore.getState().addObject(
      makeObject({ id: 'obj-1', updated_at: '2026-02-01T00:00:00.000Z', x: 100 }),
    )
    handleRealtimePayload(
      updatePayload(makeObject({ id: 'obj-1', updated_at: '2026-01-01T00:00:00.000Z', x: 999 })),
    )
    expect(useBoardStore.getState().objects[0].x).toBe(100)
  })

  it('UPDATE: applies if incoming updated_at > local', () => {
    useBoardStore.getState().addObject(
      makeObject({ id: 'obj-1', updated_at: '2026-01-01T00:00:00.000Z', x: 100 }),
    )
    handleRealtimePayload(
      updatePayload(makeObject({ id: 'obj-1', updated_at: '2026-02-01T00:00:00.000Z', x: 500 })),
    )
    expect(useBoardStore.getState().objects[0].x).toBe(500)
  })

  it('UPDATE: adds object if not found locally', () => {
    handleRealtimePayload(updatePayload(makeObject({ id: 'remote-obj' })))
    expect(useBoardStore.getState().objects).toHaveLength(1)
    expect(useBoardStore.getState().objects[0].id).toBe('remote-obj')
  })

  it('DELETE: removes object if it exists in store', () => {
    useBoardStore.getState().addObject(makeObject({ id: 'obj-1' }))
    handleRealtimePayload(deletePayload(makeObject({ id: 'obj-1' })))
    expect(useBoardStore.getState().objects).toHaveLength(0)
  })

  it('DELETE: no-op if object not in store', () => {
    handleRealtimePayload(deletePayload(makeObject({ id: 'nonexistent' })))
    expect(useBoardStore.getState().objects).toHaveLength(0)
  })
})
