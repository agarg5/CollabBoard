import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('../supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { fetchObjects, insertObject, patchObject, deleteObject } from '../boardSync'
import type { BoardObject } from '../../types/board'

const boardId = '00000000-0000-0000-0000-000000000001'

const makeObject = (overrides: Partial<BoardObject> = {}): BoardObject => ({
  id: 'obj-1',
  board_id: boardId,
  type: 'sticky_note',
  properties: { text: 'Hi', color: '#fef08a' },
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  z_index: 1,
  rotation: 0,
  created_by: 'user-1',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

function chainMock(terminal: Record<string, unknown>) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockResolvedValue(terminal)
  chain.insert = vi.fn().mockResolvedValue(terminal)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  return chain
}

describe('boardSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchObjects queries board_objects by board_id ordered by z_index', async () => {
    const objs = [makeObject()]
    const chain = chainMock({ data: objs, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await fetchObjects(boardId)

    expect(mockFrom).toHaveBeenCalledWith('board_objects')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('board_id', boardId)
    expect(chain.order).toHaveBeenCalledWith('z_index', { ascending: true })
    expect(result).toEqual(objs)
  })

  it('insertObject inserts the full object', async () => {
    const obj = makeObject()
    const chain = chainMock({ error: null })
    mockFrom.mockReturnValue(chain)

    await insertObject(obj)

    expect(mockFrom).toHaveBeenCalledWith('board_objects')
    expect(chain.insert).toHaveBeenCalledWith(obj)
  })

  it('patchObject updates by id with caller-provided changes', async () => {
    const chain = chainMock({ error: null })
    mockFrom.mockReturnValue(chain)

    const updated_at = '2026-02-16T00:00:00.000Z'
    await patchObject('obj-1', { x: 50, y: 60, updated_at })

    expect(mockFrom).toHaveBeenCalledWith('board_objects')
    expect(chain.update).toHaveBeenCalledWith({ x: 50, y: 60, updated_at })
    expect(chain.eq).toHaveBeenCalledWith('id', 'obj-1')
  })

  it('deleteObject deletes by id', async () => {
    const chain = chainMock({ error: null })
    mockFrom.mockReturnValue(chain)

    await deleteObject('obj-1')

    expect(mockFrom).toHaveBeenCalledWith('board_objects')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'obj-1')
  })

  it('fetchObjects throws on error', async () => {
    const chain = chainMock({ data: null, error: { message: 'fail' } })
    mockFrom.mockReturnValue(chain)

    await expect(fetchObjects(boardId)).rejects.toEqual({ message: 'fail' })
  })
})
